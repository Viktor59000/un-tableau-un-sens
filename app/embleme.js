// SPES — l'emblème du programme HOPE, tel qu'il serait cousu sur une combinaison ou peint sur une cloison : un écusson de mission.
// Au centre, l'arche qui quitte une Terre voilée, et au-dessus quatre points : les quatre canaux que le protocole RÉSONANCE rouvre (K, H, P, I),
// dans leurs couleurs. Autour, le nom du programme et celui de l'arche. Un seul dessin, sur canevas, sert à la fois aux pages (accueil, fin, dossier)
// et au décor 3D (hologramme de la baie) : les polices de la page s'y appliquent, ce qu'une image SVG ne permettrait pas.
const SIG = ['#fca311', '#7fe3e6', '#a8e61d', '#ff4f38'];

function arcText(g, text, cx, cy, r, mid, px, inward) { // texte le long d'un cercle, centré sur l'angle « mid » ; inward : lisible depuis le bas du cercle
  g.font = '700 ' + px + 'px Rajdhani, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const gap = px * 0.16, ws = [...text].map((ch) => g.measureText(ch).width + gap), tot = ws.reduce((a, b) => a + b, 0); let a = mid - (inward ? -1 : 1) * tot / r / 2;
  [...text].forEach((ch, i) => { const da = ws[i] / r, ang = a + (inward ? -1 : 1) * da / 2; g.save(); g.translate(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r); g.rotate(ang + (inward ? -1 : 1) * Math.PI / 2); g.fillText(ch, 0, 0); g.restore(); a += (inward ? -1 : 1) * da; });
}

export function drawEmblem(c, o = {}) {
  const S = c.width, g = c.getContext('2d'), col = o.color || '#7fe3e6', k = S / 240, cx = S / 2, cy = S / 2; g.clearRect(0, 0, S, S); g.lineCap = 'round';
  g.strokeStyle = col; g.fillStyle = col;
  g.lineWidth = 2.4 * k; g.beginPath(); g.arc(cx, cy, 113 * k, 0, 6.2832); g.stroke();
  g.lineWidth = 1 * k; g.globalAlpha = 0.6; g.beginPath(); g.arc(cx, cy, 82 * k, 0, 6.2832); g.stroke(); g.globalAlpha = 1;
  arcText(g, o.top || 'PROGRAMME HOPE', cx, cy, 97 * k, -Math.PI / 2, 19 * k, false);
  arcText(g, o.bottom || 'ARCHE SPES-07 · COHORTE R-26', cx, cy, 98 * k, Math.PI / 2, 14.5 * k, true);
  for (const s of [-1, 1]) { g.save(); g.translate(cx + s * 97 * k, cy); g.rotate(Math.PI / 4); g.fillRect(-3 * k, -3 * k, 6 * k, 6 * k); g.restore(); } // losanges de part et d'autre
  // le cœur : la Terre voilée en bas, l'arche qui s'en éloigne, les quatre canaux
  g.save(); g.beginPath(); g.arc(cx, cy, 80 * k, 0, 6.2832); g.clip();
  g.fillStyle = 'rgba(213,150,57,.26)'; g.beginPath(); g.arc(cx, cy + 150 * k, 130 * k, 0, 6.2832); g.fill();
  g.strokeStyle = '#d59639'; g.lineWidth = 1.6 * k; g.beginPath(); g.arc(cx, cy + 150 * k, 130 * k, 0, 6.2832); g.stroke(); g.restore();
  g.strokeStyle = col; g.lineWidth = 1.2 * k; g.globalAlpha = 0.75; g.setLineDash([3 * k, 5 * k]); g.beginPath(); g.moveTo(cx - 34 * k, cy + 26 * k); g.quadraticCurveTo(cx - 6 * k, cy + 10 * k, cx + 22 * k, cy - 14 * k); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; // sa trajectoire
  g.save(); g.translate(cx + 26 * k, cy - 18 * k); g.rotate(-0.72); g.fillStyle = col; g.fillRect(-15 * k, -2.6 * k, 30 * k, 5.2 * k); g.lineWidth = 1.6 * k; g.beginPath(); g.ellipse(-3 * k, 0, 4.5 * k, 11 * k, 0, 0, 6.2832); g.stroke(); g.restore(); // l'arche et son anneau
  SIG.forEach((s, i) => { const a = -2.16 + i * 0.4; g.fillStyle = s; g.beginPath(); g.arc(cx - 6 * k + Math.cos(a) * 52 * k, cy + 10 * k + Math.sin(a) * 52 * k, 3.6 * k, 0, 6.2832); g.fill(); });
  return c;
}
