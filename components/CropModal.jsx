'use client';
import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';

const TAILLE = 340;

function charger(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Image illisible'));
    i.src = src;
  });
}

// Supprime le fond noir connecté aux bords de la photo
async function enleverNoir(src, tol) {
  const img = await charger(src);
  const k = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * k);
  const h = Math.round(img.naturalHeight * k);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;
  const lum = (p) => Math.max(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]);

  const removed = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w, y * w + (w - 1)); }

  while (stack.length) {
    const p = stack.pop();
    if (removed[p] || lum(p) > tol) continue;
    removed[p] = 1;
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }

  for (let p = 0; p < w * h; p++) {
    if (removed[p]) {
      d[p * 4 + 3] = 0;
      continue;
    }
    // bord adouci pour éviter un liseré noir
    const x = p % w;
    const y = (p / w) | 0;
    const touche =
      (x > 0 && removed[p - 1]) ||
      (x < w - 1 && removed[p + 1]) ||
      (y > 0 && removed[p - w]) ||
      (y < h - 1 && removed[p + w]);
    if (touche) {
      const a = Math.min(1, lum(p) / (tol * 3));
      d[p * 4 + 3] = Math.round(a * 255);
    }
  }

  ctx.putImageData(im, 0, 0);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  return URL.createObjectURL(blob);
}

async function getCroppedBlob(src, area, fond) {
  const img = await charger(src);
  const size = 640;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (fond) {
    ctx.fillStyle = fond;
    ctx.fillRect(0, 0, size, size);
  }

  const scale = size / area.width;
  ctx.drawImage(img, -area.x * scale, -area.y * scale, img.naturalWidth * scale, img.naturalHeight * scale);

  return new Promise((res) => canvas.toBlob(res, 'image/webp', 0.85));
}

const DAMIER = 'repeating-conic-gradient(#555 0% 25%, #777 0% 50%) 50% / 24px 24px';

export default function CropModal({ src, onCancel, onDone }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fond, setFond] = useState(null);
  const [couleur, setCouleur] = useState('#3a1d0d');
  const [noir, setNoir] = useState(false);
  const [tol, setTol] = useState(40);
  const [shown, setShown] = useState(src);
  const [calc, setCalc] = useState(false);

  const onComplete = useCallback((_, pixels) => setArea(pixels), []);

  useEffect(() => {
    if (!noir) {
      setShown(src);
      return;
    }
    let annule = false;
    let url = null;
    setCalc(true);
    const t = setTimeout(async () => {
      try {
        url = await enleverNoir(src, tol);
        if (!annule) setShown(url);
      } catch (e) {
        if (!annule) {
          alert('Suppression du fond impossible : ' + e.message);
          setNoir(false);
        }
      }
      if (!annule) setCalc(false);
    }, 250);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [noir, tol, src]);

  async function ok() {
    if (!area) return;
    setBusy(true);
    try {
      onDone(await getCroppedBlob(shown, area, fond));
    } catch (e) {
      alert('Recadrage impossible : ' + e.message);
      setBusy(false);
    }
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <div
          style={{
            position: 'absolute', top: '50%', left: '50%',
            width: TAILLE, height: TAILLE, transform: 'translate(-50%, -50%)',
            borderRadius: '50%', background: fond || DAMIER,
          }}
        />
        <Cropper
          image={shown}
          crop={crop}
          zoom={zoom}
          minZoom={0.3}
          maxZoom={3}
          restrictPosition={false}
          aspect={1}
          cropSize={{ width: TAILLE, height: TAILLE }}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onComplete}
          style={{
            containerStyle: { background: 'transparent' },
            cropAreaStyle: { color: 'rgba(0,0,0,.85)' },
          }}
        />
      </div>

      <div style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'center', background: '#1c1208', color: '#fff' }}>
        <input type="range" min={0.3} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(+e.target.value)} style={{ width: 180 }} />

        <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={noir} onChange={(e) => setNoir(e.target.checked)} />
          Supprimer le fond noir {calc && '…'}
        </label>
        {noir && (
          <input type="range" min={10} max={90} step={2} value={tol} onChange={(e) => setTol(+e.target.value)} style={{ width: 120 }} title="Sensibilité" />
        )}

        <span>Fond :</span>
        <button className="btn" style={{ opacity: fond ? 0.5 : 1 }} onClick={() => setFond(null)}>Transparent</button>
        <input
          type="color"
          value={couleur}
          onChange={(e) => { setCouleur(e.target.value); setFond(e.target.value); }}
          style={{ width: 44, height: 36, border: 0, padding: 0, background: 'none', cursor: 'pointer' }}
          title="Choisir une couleur"
        />

        <button className="lnk" style={{ color: '#fff' }} onClick={onCancel}>Annuler</button>
        <button className="btn" onClick={ok} disabled={busy || calc}>{busy ? 'Envoi…' : 'Valider'}</button>
      </div>
    </div>,
    document.body
  );
}