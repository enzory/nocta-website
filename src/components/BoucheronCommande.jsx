import { useState, useMemo } from "react";
import { jsPDF } from "jspdf";

// Logo NOCTA Catering en base64 (JPEG 400x200, ~1.2 Ko).
// Utilisé uniquement dans generatePDF() pour l'export A4.
// Le rendu UI utilise NoctaSvgLogo (SVG inline) — ne pas confondre.
const LOGO_NOCTA_JPEG_B64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCADIAZADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAEI/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwDGQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACoAAAAAAAAAAAAAAAKgAAAqAAAAAAAAAAAAAAACoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKgAAAAAAAqAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACoAAAAAAAAAAAKgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/9k=";

const PRIX_UNITAIRE = 2.9;
const FRAIS_LIVRAISON = 20.0;
const TVA = 0.1;
const MINIMUM_HT = 250.0;
const MIN_QTY_PER_ITEM = 20;

const PALIERS = [
  { min: 0,   max: 200, varietes: 4, maxProt: 2 },
  { min: 200, max: 400, varietes: 6, maxProt: 3 },
  { min: 400, max: Infinity, varietes: 8, maxProt: 4 },
];

const getTier = (totalPieces) => {
  for (let i = PALIERS.length - 1; i >= 0; i--) {
    if (totalPieces >= PALIERS[i].min) return PALIERS[i];
  }
  return PALIERS[0];
};

const CATALOGUE = {
  proteine: [
    { id: "p1", nom: "Pic courgette en violon, mozzarella et crevette" },
    { id: "p2", nom: "Trident saumon, gel de citron vert, laquage aigre-doux, cébette et sésame" },
    { id: "p3", nom: "Pic estival : pêche, mozzarella, basilic et jambon" },
    { id: "p4", nom: "Bouchée : gressin et charcuterie (enroulé)" },
  ],
  veggie: [
    { id: "v1", nom: "Trident végétarien : cube de polenta au parmesan, tomate confite et tapenade noire" },
    { id: "v2", nom: "Pic salade grecque" },
    { id: "v3", nom: "Pic italien : tomate, olive et artichauts confits" },
    { id: "v4", nom: "Finger végétarien : financier à l'olive noire, confit d'oignons et pickles" },
  ],
};

const fmt = (n) => n.toFixed(2).replace(".", ",") + " €";

export default function BoucheronCommande() {
  const [selected, setSelected] = useState({ proteine: [], veggie: [] });
  const [quantities, setQuantities] = useState({});
  const [date, setDate] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const totalPieces = useMemo(
    () => Object.values(quantities).reduce((s, v) => s + v, 0),
    [quantities]
  );

  const tier = getTier(totalPieces);
  const totalSelected = selected.proteine.length + selected.veggie.length;

  const toggleItem = (segment, id) => {
    setSelected((prev) => {
      const current = prev[segment];
      if (current.includes(id)) {
        const next = current.filter((x) => x !== id);
        setQuantities((q) => { const nq = { ...q }; delete nq[id]; return nq; });
        return { ...prev, [segment]: next };
      }
      const total = prev.proteine.length + prev.veggie.length;
      if (total >= tier.varietes) return prev;
      if (segment === "proteine" && current.length >= tier.maxProt) return prev;
      setQuantities((q) => ({ ...q, [id]: MIN_QTY_PER_ITEM }));
      return { ...prev, [segment]: [...current, id] };
    });
  };

  const stepQty = (id, direction) => {
    setQuantities((q) => {
      const cur = q[id] || 0;
      const next = cur + direction * 10;
      if (next < MIN_QTY_PER_ITEM) return { ...q, [id]: MIN_QTY_PER_ITEM };
      return { ...q, [id]: next };
    });
  };

  const sousTotal = totalPieces * PRIX_UNITAIRE;
  const totalHT = sousTotal + FRAIS_LIVRAISON;
  const montantTVA = totalHT * TVA;
  const totalTTC = totalHT + montantTVA;

  /* ── Validation dynamique ── */
  const MIN_VARIETES = 4;
  const selectionComplete = totalSelected >= MIN_VARIETES;
  const proteineOverflow = selected.proteine.length > tier.maxProt;
  const varietiesOverflow = totalSelected > tier.varietes;
  const allHaveQty = [...selected.proteine, ...selected.veggie].every(
    (id) => (quantities[id] || 0) >= MIN_QTY_PER_ITEM
  );
  const minimumOk = totalHT >= MINIMUM_HT;

  const totalProtPieces = selected.proteine.reduce((s, id) => s + (quantities[id] || 0), 0);
  const totalVeggiePieces = selected.veggie.reduce((s, id) => s + (quantities[id] || 0), 0);
  const isFullVeggie = totalProtPieces === 0;
  const volumeEqual = totalProtPieces === totalVeggiePieces;
  const hasAnyQty = totalPieces > 0;

  const isBalanced = !proteineOverflow && !varietiesOverflow && (volumeEqual || isFullVeggie || !hasAnyQty);

  const alertMessages = [];
  if (proteineOverflow) {
    alertMessages.push(
      `Déséquilibre détecté : vous avez ${selected.proteine.length} protéinée(s) sélectionnée(s), le maximum autorisé pour ce palier (${tier.min}–${tier.max === Infinity ? "∞" : tier.max} pièces) est de ${tier.maxProt}. Désélectionnez une protéinée ou augmentez les quantités pour passer au palier suivant.`
    );
  }
  if (varietiesOverflow) {
    alertMessages.push(
      `Trop de variétés sélectionnées : ${totalSelected} sur ${tier.varietes} autorisées pour ce palier. Désélectionnez une référence ou augmentez les quantités pour débloquer plus de variétés.`
    );
  }
  if (hasAnyQty && !volumeEqual && !isFullVeggie) {
    alertMessages.push(
      `Volumes non équilibrés : ${totalProtPieces} pièce(s) protéinée(s) vs ${totalVeggiePieces} pièce(s) végétarienne(s). Les deux segments doivent avoir un total de pièces strictement identique, ou la commande doit être 100 % végétarienne.`
    );
  }

  const canSubmit = selectionComplete && allHaveQty && minimumOk && isBalanced;

  const dateMinimum = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  })();

  const allItems = [...CATALOGUE.proteine, ...CATALOGUE.veggie];
  const getItemName = (id) => allItems.find((i) => i.id === id)?.nom || id;

  const buildRecap = () => {
    const lines = [...selected.proteine, ...selected.veggie].map(
      (id) => `• ${getItemName(id)} — ${quantities[id] || 0} pièces`
    );
    return [
      `COMMANDE BOUCHERON — NOCTA`,
      `Date souhaitée : ${date || "Non précisée"}`,
      ``,
      `Détail :`,
      ...lines,
      ``,
      `${totalPieces} pièces × ${fmt(PRIX_UNITAIRE)} = ${fmt(sousTotal)}`,
      `Livraison : ${fmt(FRAIS_LIVRAISON)}`,
      `Total HT : ${fmt(totalHT)}`,
      `TVA 10% : ${fmt(montantTVA)}`,
      `Total TTC : ${fmt(totalTTC)}`,
      commentaire ? `\nCommentaire : ${commentaire}` : "",
    ].join("\n");
  };

  const generatePDF = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const margin = 24;
    let y = 15;

    doc.addImage(LOGO_NOCTA_JPEG_B64, 'JPEG', 15, 15, 40, 20);
    y = 38;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pw - margin, y);
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(26, 26, 26);
    doc.text("Bon de commande — Boucheron", pw / 2, y, { align: "center" });
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const today = new Date().toLocaleDateString("fr-FR");
    doc.text(`Émis le ${today}`, pw / 2, y, { align: "center" });
    y += 6;
    if (date) {
      doc.text(`Date souhaitée : ${new Date(date).toLocaleDateString("fr-FR")}`, pw / 2, y, { align: "center" });
      y += 6;
    }
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(26, 26, 26);
    doc.text("DÉTAIL DE LA COMMANDE", margin, y);
    y += 8;

    const items = [...selected.proteine, ...selected.veggie];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    items.forEach((id) => {
      const nom = getItemName(id);
      const qty = quantities[id] || 0;
      const lineTotal = qty * PRIX_UNITAIRE;
      const lines = doc.splitTextToSize(nom, pw - margin * 2 - 50);
      lines.forEach((line, i) => {
        doc.setTextColor(26, 26, 26);
        doc.text(line, margin, y);
        if (i === 0) {
          doc.setTextColor(80, 80, 80);
          doc.text(`${qty} pcs  ${fmt(lineTotal)}`, pw - margin, y, { align: "right" });
        }
        y += 5;
      });
      y += 2;
    });

    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pw - margin, y);
    y += 8;

    const addTotalLine = (label, value, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(bold ? 11 : 9.5);
      doc.setTextColor(26, 26, 26);
      doc.text(label, margin, y);
      doc.text(value, pw - margin, y, { align: "right" });
      y += bold ? 7 : 5.5;
    };

    addTotalLine(`Sous-total (${totalPieces} pièces)`, fmt(sousTotal));
    addTotalLine("Livraison", fmt(FRAIS_LIVRAISON));
    addTotalLine("Total HT", fmt(totalHT), true);
    addTotalLine("TVA 10 %", fmt(montantTVA));
    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pw - margin, y);
    y += 8;
    addTotalLine("Total TTC", fmt(totalTTC), true);

    if (commentaire) {
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("Commentaire :", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const cLines = doc.splitTextToSize(commentaire, pw - margin * 2);
      cLines.forEach((l) => { doc.text(l, margin, y); y += 5; });
    }

    y = doc.internal.pageSize.getHeight() - 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text("NOCTA · H+E Catering SARL · Courbevoie · contact@noctaparis.fr", pw / 2, y, { align: "center" });

    const dateStr = new Date().toISOString().slice(0, 10);
    doc.save(`NOCTA-Commande-Boucheron-${dateStr}.pdf`);
  };

  const handleSubmit = async () => {
    const body = buildRecap();
    generatePDF();
    try {
      await fetch("https://formspree.io/f/maqpwebj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _subject: `Commande Boucheron — ${date || "Sans date"}`,
          message: body,
          _replyto: "myriana@boucheron.com",
          _cc: "myriana@boucheron.com",
        }),
      });
      setSubmitted(true);
    } catch {
      alert("Erreur lors de l'envoi. Veuillez réessayer.");
    }
  };

  /* ── Dual Logo Header ── */
  const NoctaSvgLogo = () => (
    <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="83 28 170 75" preserveAspectRatio="xMidYMid meet" version="1.0" aria-hidden="true" style={{ height: 48, width: 'auto', color: '#1a1a1a' }}><defs><g/><clipPath id="bc-clip-a"><rect x="0" width="87" y="0" height="40"/></clipPath><clipPath id="bc-clip-b"><path d="M 51 8 L 60.878906 8 L 60.878906 20 L 51 20 Z M 51 8 " clipRule="nonzero"/></clipPath><clipPath id="bc-clip-c"><rect x="0" width="61" y="0" height="21"/></clipPath></defs><g transform="matrix(1, 0, 0, 1, 83, 50)"><g clipPath="url(#bc-clip-a)"><g fill="currentColor" fillOpacity="1"><g transform="translate(0.403948, 28.590412)"><g><path d="M 2.734375 0 C 2.796875 -0.34375 2.828125 -0.71875 2.828125 -1.125 L 2.828125 -20.109375 L 5.859375 -20.109375 L 13.859375 -7.5 L 13.859375 -19.078125 C 13.859375 -19.640625 13.8125 -19.984375 13.71875 -20.109375 L 17.796875 -20.109375 C 17.742188 -19.703125 17.71875 -19.257812 17.71875 -18.78125 L 17.71875 0 L 14.578125 0 L 6.6875 -12.109375 L 6.6875 0 Z M 2.734375 0 "/></g></g></g><g fill="currentColor" fillOpacity="1"><g transform="translate(18.415333, 28.590412)"><g><path d="M 4.25 -2.390625 C 3.332031 -3.265625 2.609375 -4.316406 2.078125 -5.546875 C 1.546875 -6.773438 1.28125 -8.125 1.28125 -9.59375 C 1.28125 -11.0625 1.523438 -12.445312 2.015625 -13.75 C 2.515625 -15.0625 3.222656 -16.21875 4.140625 -17.21875 C 5.054688 -18.21875 6.164062 -19.007812 7.46875 -19.59375 C 8.769531 -20.1875 10.226562 -20.484375 11.84375 -20.484375 C 14.625 -20.484375 16.96875 -19.609375 18.875 -17.859375 C 20.90625 -15.984375 21.921875 -13.453125 21.921875 -10.265625 C 21.921875 -7.179688 20.875 -4.617188 18.78125 -2.578125 C 17.488281 -1.316406 15.953125 -0.445312 14.171875 0.03125 C 13.296875 0.257812 12.269531 0.375 11.09375 0.375 C 9.914062 0.375 8.707031 0.132812 7.46875 -0.34375 C 6.238281 -0.832031 5.164062 -1.515625 4.25 -2.390625 Z M 5.484375 -9.796875 C 5.484375 -8.859375 5.640625 -7.992188 5.953125 -7.203125 C 6.265625 -6.421875 6.703125 -5.75 7.265625 -5.1875 C 8.441406 -4 9.957031 -3.40625 11.8125 -3.40625 C 13.570312 -3.40625 14.988281 -3.972656 16.0625 -5.109375 C 17.144531 -6.285156 17.6875 -7.894531 17.6875 -9.9375 C 17.6875 -11.851562 17.171875 -13.453125 16.140625 -14.734375 C 15.015625 -16.097656 13.476562 -16.78125 11.53125 -16.78125 C 9.644531 -16.78125 8.148438 -16.085938 7.046875 -14.703125 C 6.003906 -13.398438 5.484375 -11.765625 5.484375 -9.796875 Z M 5.484375 -9.796875 "/></g></g></g><g fill="currentColor" fillOpacity="1"><g transform="translate(39.088219, 28.590412)"><g><path d="M 11.609375 -20.484375 C 13.492188 -20.484375 15.101562 -20.15625 16.4375 -19.5 L 16.4375 -14.875 L 16.40625 -14.84375 C 15.84375 -15.71875 14.65625 -16.296875 12.84375 -16.578125 C 12.300781 -16.660156 11.625 -16.703125 10.8125 -16.703125 C 10 -16.703125 9.195312 -16.546875 8.40625 -16.234375 C 7.625 -15.929688 6.976562 -15.5 6.46875 -14.9375 C 5.488281 -13.84375 5 -12.273438 5 -10.234375 C 5 -7.867188 5.617188 -6.101562 6.859375 -4.9375 C 7.890625 -3.976562 9.253906 -3.5 10.953125 -3.5 C 12.867188 -3.5 14.421875 -3.90625 15.609375 -4.71875 C 16.035156 -5.007812 16.398438 -5.375 16.703125 -5.8125 L 16.75 -5.78125 L 16.75 -1.546875 C 15.207031 -0.265625 13.132812 0.375 10.53125 0.375 C 7.445312 0.375 5.035156 -0.601562 3.296875 -2.5625 C 1.617188 -4.425781 0.78125 -6.894531 0.78125 -9.96875 C 0.78125 -13.21875 1.695312 -15.78125 3.53125 -17.65625 C 5.394531 -19.539062 8.085938 -20.484375 11.609375 -20.484375 Z M 11.609375 -20.484375 "/></g></g></g><g fill="currentColor" fillOpacity="1"><g transform="translate(54.51371, 28.590412)"><g><path d="M 9.859375 0.09375 C 9.378906 0.03125 8.132812 0 6.125 0 L 5.640625 0 L 5.640625 -16.71875 L 2.640625 -16.71875 C 1.753906 -16.71875 1.226562 -16.671875 1.0625 -16.578125 C 0.90625 -16.492188 0.785156 -16.414062 0.703125 -16.34375 L 0.65625 -16.359375 L 0.65625 -20.234375 L 0.703125 -20.28125 C 1.023438 -20.164062 1.921875 -20.109375 3.390625 -20.109375 L 12.875 -20.109375 C 13.757812 -20.109375 14.28125 -20.15625 14.4375 -20.25 C 14.601562 -20.34375 14.726562 -20.421875 14.8125 -20.484375 L 14.859375 -20.46875 L 14.859375 -16.609375 L 14.8125 -16.5625 C 14.476562 -16.664062 13.582031 -16.71875 12.125 -16.71875 L 9.859375 -16.71875 Z M 9.859375 0.09375 "/></g></g></g><g fill="currentColor" fillOpacity="1"><g transform="translate(67.489413, 28.590412)"><g><path d="M 4.0625 0.125 C 3.195312 0.0390625 2.1875 0 1.03125 0 L -0.171875 0 L 6.40625 -18.4375 C 6.695312 -19.257812 6.84375 -19.738281 6.84375 -19.875 C 6.84375 -20.007812 6.835938 -20.09375 6.828125 -20.125 L 6.84375 -20.15625 C 7.5 -20.125 8.195312 -20.109375 8.9375 -20.109375 C 9.539062 -20.109375 10.265625 -20.117188 11.109375 -20.140625 L 11.125 -20.109375 C 11.101562 -20.066406 11.09375 -20.007812 11.09375 -19.9375 C 11.09375 -19.75 11.242188 -19.242188 11.546875 -18.421875 L 18.265625 0.046875 C 18.066406 0.0351562 17.832031 0.03125 17.5625 0.03125 C 17.5625 0.03125 17.296875 0.0195312 16.765625 0 C 16.515625 0 16.289062 0 16.09375 0 L 13.75 0 L 12.328125 -4.359375 L 5.484375 -4.359375 Z M 11.140625 -7.984375 L 8.859375 -15.015625 L 6.640625 -7.984375 Z M 11.140625 -7.984375 "/></g></g></g></g></g><g transform="matrix(1, 0, 0, 1, 98, 73)"><g clipPath="url(#bc-clip-c)"><g fill="currentColor" fillOpacity="1"><g transform="translate(0.585213, 16.551818)"><g><path d="M 10.375 -10.3125 C 10.226562 -9.9375 10.078125 -9.476562 9.921875 -8.9375 C 9.765625 -8.394531 9.601562 -7.734375 9.4375 -6.953125 L 9.109375 -6.953125 C 9.191406 -7.460938 9.21875 -7.890625 9.1875 -8.234375 C 9.164062 -8.578125 9.09375 -8.867188 8.96875 -9.109375 C 8.78125 -9.484375 8.515625 -9.765625 8.171875 -9.953125 C 7.828125 -10.148438 7.457031 -10.25 7.0625 -10.25 C 6.5625 -10.25 6.070312 -10.097656 5.59375 -9.796875 C 5.113281 -9.503906 4.671875 -9.101562 4.265625 -8.59375 C 3.859375 -8.09375 3.5 -7.523438 3.1875 -6.890625 C 2.875 -6.253906 2.628906 -5.59375 2.453125 -4.90625 C 2.285156 -4.226562 2.203125 -3.5625 2.203125 -2.90625 C 2.203125 -1.957031 2.382812 -1.242188 2.75 -0.765625 C 3.125 -0.296875 3.632812 -0.0625 4.28125 -0.0625 C 4.6875 -0.0625 5.128906 -0.15625 5.609375 -0.34375 C 6.085938 -0.539062 6.507812 -0.820312 6.875 -1.1875 C 7.132812 -1.457031 7.359375 -1.769531 7.546875 -2.125 C 7.734375 -2.476562 7.945312 -2.9375 8.1875 -3.5 L 8.5 -3.5 C 8.257812 -2.613281 8.070312 -1.898438 7.9375 -1.359375 C 7.8125 -0.816406 7.710938 -0.363281 7.640625 0 L 7.328125 0 C 7.359375 -0.207031 7.375 -0.375 7.375 -0.5 C 7.375 -0.71875 7.332031 -0.835938 7.25 -0.859375 C 7.175781 -0.890625 7.054688 -0.851562 6.890625 -0.75 C 6.628906 -0.570312 6.363281 -0.410156 6.09375 -0.265625 C 5.832031 -0.128906 5.546875 -0.0195312 5.234375 0.0625 C 4.929688 0.15625 4.566406 0.203125 4.140625 0.203125 C 3.066406 0.203125 2.234375 -0.0820312 1.640625 -0.65625 C 1.046875 -1.238281 0.75 -2.09375 0.75 -3.21875 C 0.75 -3.875 0.847656 -4.546875 1.046875 -5.234375 C 1.253906 -5.921875 1.546875 -6.578125 1.921875 -7.203125 C 2.296875 -7.835938 2.742188 -8.398438 3.265625 -8.890625 C 3.796875 -9.390625 4.378906 -9.785156 5.015625 -10.078125 C 5.660156 -10.367188 6.351562 -10.515625 7.09375 -10.515625 C 7.507812 -10.515625 7.847656 -10.46875 8.109375 -10.375 C 8.367188 -10.28125 8.585938 -10.160156 8.765625 -10.015625 C 8.953125 -9.878906 9.117188 -9.726562 9.265625 -9.5625 C 9.398438 -9.425781 9.523438 -9.410156 9.640625 -9.515625 C 9.765625 -9.617188 9.90625 -9.882812 10.0625 -10.3125 Z M 10.375 -10.3125 "/></g></g></g><g fill="currentColor" fillOpacity="1"><g transform="translate(11.064306, 16.551818)"><g><path d="M 1.921875 -0.265625 C 2.148438 -0.265625 2.414062 -0.410156 2.71875 -0.703125 C 3.019531 -1.003906 3.328125 -1.40625 3.640625 -1.90625 C 3.953125 -2.414062 4.238281 -2.988281 4.5 -3.625 C 4.757812 -4.269531 4.96875 -4.9375 5.125 -5.625 L 4.875 -4.046875 C 4.507812 -3.015625 4.140625 -2.1875 3.765625 -1.5625 C 3.398438 -0.9375 3.023438 -0.484375 2.640625 -0.203125 C 2.265625 0.0664062 1.882812 0.203125 1.5 0.203125 C 1.039062 0.203125 0.695312 0.0390625 0.46875 -0.28125 C 0.238281 -0.613281 0.125 -1.039062 0.125 -1.5625 C 0.125 -2.019531 0.203125 -2.523438 0.359375 -3.078125 C 0.515625 -3.628906 0.726562 -4.175781 1 -4.71875 C 1.28125 -5.257812 1.597656 -5.753906 1.953125 -6.203125 C 2.316406 -6.648438 2.707031 -7.007812 3.125 -7.28125 C 3.550781 -7.550781 3.984375 -7.6875 4.421875 -7.6875 C 4.765625 -7.6875 5.023438 -7.519531 5.203125 -7.1875 C 5.378906 -6.851562 5.414062 -6.382812 5.3125 -5.78125 L 5.15625 -5.6875 C 5.21875 -6.207031 5.179688 -6.625 5.046875 -6.9375 C 4.910156 -7.25 4.691406 -7.40625 4.390625 -7.40625 C 4.128906 -7.40625 3.859375 -7.28125 3.578125 -7.03125 C 3.304688 -6.789062 3.039062 -6.457031 2.78125 -6.03125 C 2.53125 -5.613281 2.300781 -5.140625 2.09375 -4.609375 C 1.882812 -4.085938 1.71875 -3.546875 1.59375 -2.984375 C 1.46875 -2.429688 1.40625 -1.898438 1.40625 -1.390625 C 1.40625 -0.960938 1.453125 -0.664062 1.546875 -0.5 C 1.640625 -0.34375 1.765625 -0.265625 1.921875 -0.265625 Z M 5.59375 -7.484375 C 5.820312 -7.492188 6.050781 -7.515625 6.28125 -7.546875 C 6.519531 -7.578125 6.738281 -7.625 6.9375 -7.6875 L 5.109375 -1.25 C 5.085938 -1.164062 5.0625 -1.050781 5.03125 -0.90625 C 5 -0.769531 5 -0.640625 5.03125 -0.515625 C 5.0625 -0.398438 5.160156 -0.34375 5.328125 -0.34375 C 5.523438 -0.34375 5.710938 -0.445312 5.890625 -0.65625 C 6.078125 -0.875 6.265625 -1.265625 6.453125 -1.828125 L 6.625 -2.375 L 6.90625 -2.375 L 6.53125 -1.3125 C 6.394531 -0.925781 6.234375 -0.625 6.046875 -0.40625 C 5.859375 -0.1875 5.660156 -0.03125 5.453125 0.0625 C 5.253906 0.15625 5.054688 0.203125 4.859375 0.203125 C 4.484375 0.203125 4.21875 0.078125 4.0625 -0.171875 C 3.9375 -0.398438 3.898438 -0.660156 3.953125 -0.953125 C 4.015625 -1.242188 4.085938 -1.539062 4.171875 -1.84375 Z M 5.59375 -7.484375 "/></g></g></g><g fill="currentColor" fillOpacity="1"><g transform="translate(19.403944, 16.551818)"><g><path d="M 5.46875 -7.484375 L 5.421875 -7.1875 L 0.890625 -7.1875 L 0.96875 -7.484375 Z M 1.765625 -1.234375 C 1.671875 -0.910156 1.691406 -0.675781 1.828125 -0.53125 C 1.960938 -0.394531 2.132812 -0.328125 2.34375 -0.328125 C 2.5625 -0.328125 2.773438 -0.421875 2.984375 -0.609375 C 3.203125 -0.796875 3.421875 -1.191406 3.640625 -1.796875 L 3.84375 -2.359375 L 4.125 -2.359375 L 3.8125 -1.4375 C 3.601562 -0.8125 3.328125 -0.378906 2.984375 -0.140625 C 2.648438 0.0859375 2.265625 0.203125 1.828125 0.203125 C 1.421875 0.203125 1.113281 0.117188 0.90625 -0.046875 C 0.695312 -0.222656 0.570312 -0.460938 0.53125 -0.765625 C 0.5 -1.078125 0.539062 -1.429688 0.65625 -1.828125 L 2.90625 -9.703125 C 3.144531 -9.710938 3.378906 -9.726562 3.609375 -9.75 C 3.835938 -9.78125 4.039062 -9.832031 4.21875 -9.90625 Z M 1.765625 -1.234375 "/></g></g></g><g fill="currentColor" fillOpacity="1"><g transform="translate(25.02196, 16.551818)"><g><path d="M 1.21875 -3.3125 C 1.757812 -3.488281 2.25 -3.664062 2.6875 -3.84375 C 3.132812 -4.03125 3.488281 -4.222656 3.75 -4.421875 C 4.101562 -4.703125 4.378906 -5.039062 4.578125 -5.4375 C 4.785156 -5.84375 4.890625 -6.28125 4.890625 -6.75 C 4.890625 -7.03125 4.867188 -7.207031 4.828125 -7.28125 C 4.796875 -7.363281 4.738281 -7.40625 4.65625 -7.40625 C 4.414062 -7.40625 4.15625 -7.296875 3.875 -7.078125 C 3.59375 -6.867188 3.316406 -6.578125 3.046875 -6.203125 C 2.773438 -5.835938 2.523438 -5.414062 2.296875 -4.9375 C 2.066406 -4.457031 1.882812 -3.945312 1.75 -3.40625 C 1.613281 -2.875 1.546875 -2.34375 1.546875 -1.8125 C 1.546875 -1.3125 1.632812 -0.953125 1.8125 -0.734375 C 2 -0.515625 2.242188 -0.40625 2.546875 -0.40625 C 2.898438 -0.40625 3.269531 -0.507812 3.65625 -0.71875 C 4.039062 -0.9375 4.421875 -1.316406 4.796875 -1.859375 L 5.03125 -1.75 C 4.84375 -1.425781 4.597656 -1.113281 4.296875 -0.8125 C 3.992188 -0.507812 3.65625 -0.265625 3.28125 -0.078125 C 2.90625 0.109375 2.507812 0.203125 2.09375 0.203125 C 1.707031 0.203125 1.367188 0.125 1.078125 -0.03125 C 0.785156 -0.1875 0.5625 -0.414062 0.40625 -0.71875 C 0.25 -1.019531 0.171875 -1.394531 0.171875 -1.84375 C 0.171875 -2.257812 0.25 -2.726562 0.40625 -3.25 C 0.5625 -3.769531 0.78125 -4.289062 1.0625 -4.8125 C 1.351562 -5.332031 1.695312 -5.8125 2.09375 -6.25 C 2.488281 -6.6875 2.929688 -7.035156 3.421875 -7.296875 C 3.910156 -7.554688 4.429688 -7.6875 4.984375 -7.6875 C 5.285156 -7.6875 5.539062 -7.601562 5.75 -7.4375 C 5.957031 -7.28125 6.0625 -7.046875 6.0625 -6.734375 C 6.0625 -6.335938 5.945312 -5.972656 5.71875 -5.640625 C 5.488281 -5.304688 5.1875 -5 4.8125 -4.71875 C 4.4375 -4.445312 4.03125 -4.203125 3.59375 -3.984375 C 3.15625 -3.773438 2.726562 -3.59375 2.3125 -3.4375 C 1.894531 -3.28125 1.523438 -3.15625 1.203125 -3.0625 Z M 1.21875 -3.3125 "/></g></g></g><g fill="currentColor" fillOpacity="1"><g transform="translate(31.99351, 16.551818)"><g><path d="M 1.765625 0 L 0.5 0 L 2.25 -6.25 C 2.34375 -6.582031 2.367188 -6.816406 2.328125 -6.953125 C 2.296875 -7.085938 2.195312 -7.15625 2.03125 -7.15625 C 1.820312 -7.15625 1.628906 -7.039062 1.453125 -6.8125 C 1.273438 -6.59375 1.09375 -6.210938 0.90625 -5.671875 L 0.71875 -5.125 L 0.4375 -5.125 L 0.796875 -6.1875 C 0.941406 -6.59375 1.113281 -6.898438 1.3125 -7.109375 C 1.507812 -7.328125 1.71875 -7.476562 1.9375 -7.5625 C 2.15625 -7.644531 2.363281 -7.6875 2.5625 -7.6875 C 2.851562 -7.6875 3.054688 -7.625 3.171875 -7.5 C 3.296875 -7.375 3.363281 -7.207031 3.375 -7 C 3.394531 -6.800781 3.382812 -6.582031 3.34375 -6.34375 C 3.300781 -6.101562 3.25 -5.875 3.1875 -5.65625 Z M 5.5 -7.328125 C 5.28125 -7.328125 5.050781 -7.222656 4.8125 -7.015625 C 4.570312 -6.804688 4.328125 -6.503906 4.078125 -6.109375 C 3.835938 -5.710938 3.59375 -5.238281 3.34375 -4.6875 C 3.09375 -4.144531 2.847656 -3.535156 2.609375 -2.859375 C 2.367188 -2.191406 2.140625 -1.472656 1.921875 -0.703125 L 2.28125 -2.5625 C 2.601562 -3.507812 2.898438 -4.304688 3.171875 -4.953125 C 3.453125 -5.609375 3.726562 -6.140625 4 -6.546875 C 4.269531 -6.953125 4.546875 -7.242188 4.828125 -7.421875 C 5.117188 -7.597656 5.425781 -7.6875 5.75 -7.6875 C 6.019531 -7.6875 6.226562 -7.609375 6.375 -7.453125 C 6.53125 -7.296875 6.609375 -7.097656 6.609375 -6.859375 C 6.609375 -6.660156 6.554688 -6.484375 6.453125 -6.328125 C 6.359375 -6.171875 6.238281 -6.046875 6.09375 -5.953125 C 5.945312 -5.859375 5.78125 -5.8125 5.59375 -5.8125 C 5.425781 -5.8125 5.285156 -5.859375 5.171875 -5.953125 C 5.066406 -6.046875 5.015625 -6.171875 5.015625 -6.328125 C 5.015625 -6.484375 5.039062 -6.625 5.09375 -6.75 C 5.15625 -6.875 5.234375 -6.976562 5.328125 -7.0625 C 5.421875 -7.144531 5.535156 -7.210938 5.671875 -7.265625 C 5.648438 -7.285156 5.625 -7.300781 5.59375 -7.3125 C 5.570312 -7.320312 5.539062 -7.328125 5.5 -7.328125 Z M 5.5 -7.328125 "/></g></g></g><g fill="currentColor" fillOpacity="1"><g transform="translate(38.921396, 16.551818)"><g><path d="M 2.75 -10.140625 C 2.800781 -10.390625 2.929688 -10.601562 3.140625 -10.78125 C 3.347656 -10.96875 3.570312 -11.0625 3.8125 -11.0625 C 4.0625 -11.0625 4.253906 -10.96875 4.390625 -10.78125 C 4.535156 -10.601562 4.585938 -10.390625 4.546875 -10.140625 C 4.492188 -9.878906 4.363281 -9.65625 4.15625 -9.46875 C 3.945312 -9.289062 3.71875 -9.203125 3.46875 -9.203125 C 3.226562 -9.203125 3.035156 -9.289062 2.890625 -9.46875 C 2.742188 -9.65625 2.695312 -9.878906 2.75 -10.140625 Z M 2.296875 -6.25 C 2.503906 -6.851562 2.4375 -7.15625 2.09375 -7.15625 C 1.875 -7.15625 1.675781 -7.03125 1.5 -6.78125 C 1.320312 -6.539062 1.140625 -6.171875 0.953125 -5.671875 L 0.75 -5.125 L 0.46875 -5.125 L 0.84375 -6.1875 C 0.988281 -6.59375 1.160156 -6.898438 1.359375 -7.109375 C 1.566406 -7.328125 1.785156 -7.476562 2.015625 -7.5625 C 2.242188 -7.644531 2.457031 -7.6875 2.65625 -7.6875 C 2.957031 -7.6875 3.179688 -7.625 3.328125 -7.5 C 3.472656 -7.375 3.5625 -7.207031 3.59375 -7 C 3.625 -6.800781 3.613281 -6.582031 3.5625 -6.34375 C 3.519531 -6.101562 3.457031 -5.875 3.375 -5.65625 L 1.828125 -1.234375 C 1.722656 -0.953125 1.6875 -0.726562 1.71875 -0.5625 C 1.757812 -0.40625 1.867188 -0.328125 2.046875 -0.328125 C 2.242188 -0.328125 2.429688 -0.429688 2.609375 -0.640625 C 2.785156 -0.859375 2.976562 -1.253906 3.1875 -1.828125 L 3.390625 -2.359375 L 3.671875 -2.359375 L 3.296875 -1.296875 C 3.160156 -0.921875 2.992188 -0.625 2.796875 -0.40625 C 2.597656 -0.1875 2.382812 -0.03125 2.15625 0.0625 C 1.9375 0.15625 1.71875 0.203125 1.5 0.203125 C 1.082031 0.203125 0.800781 0.109375 0.65625 -0.078125 C 0.507812 -0.273438 0.453125 -0.53125 0.484375 -0.84375 C 0.523438 -1.15625 0.613281 -1.484375 0.75 -1.828125 Z M 2.296875 -6.25 "/></g></g></g><g fill="currentColor" fillOpacity="1"><g transform="translate(44.044571, 16.551818)"><g><path d="M 1.78125 0 L 0.515625 0 L 2.25 -6.25 C 2.289062 -6.363281 2.320312 -6.488281 2.34375 -6.625 C 2.375 -6.769531 2.367188 -6.894531 2.328125 -7 C 2.285156 -7.101562 2.1875 -7.15625 2.03125 -7.15625 C 1.820312 -7.15625 1.632812 -7.050781 1.46875 -6.84375 C 1.300781 -6.632812 1.117188 -6.242188 0.921875 -5.671875 L 0.734375 -5.125 L 0.453125 -5.125 L 0.8125 -6.1875 C 1.03125 -6.800781 1.296875 -7.203125 1.609375 -7.390625 C 1.921875 -7.585938 2.234375 -7.6875 2.546875 -7.6875 C 2.835938 -7.6875 3.046875 -7.625 3.171875 -7.5 C 3.304688 -7.375 3.378906 -7.210938 3.390625 -7.015625 C 3.410156 -6.816406 3.398438 -6.597656 3.359375 -6.359375 C 3.316406 -6.117188 3.265625 -5.882812 3.203125 -5.65625 Z M 2.453125 -3.03125 C 2.785156 -3.90625 3.113281 -4.632812 3.4375 -5.21875 C 3.757812 -5.8125 4.070312 -6.289062 4.375 -6.65625 C 4.6875 -7.019531 5.003906 -7.28125 5.328125 -7.4375 C 5.660156 -7.601562 6 -7.6875 6.34375 -7.6875 C 6.800781 -7.6875 7.113281 -7.578125 7.28125 -7.359375 C 7.457031 -7.140625 7.535156 -6.863281 7.515625 -6.53125 C 7.492188 -6.195312 7.425781 -5.847656 7.3125 -5.484375 L 5.890625 -1.234375 C 5.804688 -0.972656 5.769531 -0.753906 5.78125 -0.578125 C 5.800781 -0.410156 5.914062 -0.328125 6.125 -0.328125 C 6.3125 -0.328125 6.492188 -0.429688 6.671875 -0.640625 C 6.859375 -0.847656 7.050781 -1.242188 7.25 -1.828125 L 7.4375 -2.359375 L 7.71875 -2.359375 L 7.359375 -1.296875 C 7.222656 -0.890625 7.050781 -0.578125 6.84375 -0.359375 C 6.644531 -0.148438 6.4375 -0.00390625 6.21875 0.078125 C 6 0.160156 5.789062 0.203125 5.59375 0.203125 C 5.363281 0.203125 5.171875 0.160156 5.015625 0.078125 C 4.867188 0.00390625 4.753906 -0.09375 4.671875 -0.21875 C 4.566406 -0.394531 4.53125 -0.625 4.5625 -0.90625 C 4.601562 -1.1875 4.6875 -1.492188 4.8125 -1.828125 L 6.1875 -6 C 6.238281 -6.132812 6.28125 -6.296875 6.3125 -6.484375 C 6.34375 -6.671875 6.332031 -6.835938 6.28125 -6.984375 C 6.238281 -7.140625 6.101562 -7.21875 5.875 -7.21875 C 5.632812 -7.21875 5.382812 -7.113281 5.125 -6.90625 C 4.863281 -6.707031 4.59375 -6.421875 4.3125 -6.046875 C 4.03125 -5.671875 3.753906 -5.222656 3.484375 -4.703125 C 3.210938 -4.191406 2.953125 -3.617188 2.703125 -2.984375 C 2.453125 -2.359375 2.226562 -1.691406 2.03125 -0.984375 Z M 2.453125 -3.03125 "/></g></g></g></g></g><g transform="matrix(1, 0, 0, 1, 98, 73)"><g clipPath="url(#bc-clip-b)"><g fill="currentColor" fillOpacity="1"><g transform="translate(53.213793, 16.551818)"><g><path d="M 3.140625 -3.28125 L 3.515625 -3.265625 C 3.160156 -3.066406 2.832031 -2.882812 2.53125 -2.71875 C 2.238281 -2.5625 2 -2.414062 1.8125 -2.28125 C 1.632812 -2.144531 1.546875 -2.015625 1.546875 -1.890625 C 1.546875 -1.796875 1.613281 -1.707031 1.75 -1.625 C 1.882812 -1.539062 2.109375 -1.460938 2.421875 -1.390625 L 3.484375 -1.109375 C 3.796875 -1.023438 4.070312 -0.929688 4.3125 -0.828125 C 4.5625 -0.734375 4.757812 -0.609375 4.90625 -0.453125 C 5.050781 -0.296875 5.125 -0.09375 5.125 0.15625 C 5.125 0.40625 5.039062 0.679688 4.875 0.984375 C 4.71875 1.285156 4.472656 1.578125 4.140625 1.859375 C 3.804688 2.140625 3.367188 2.375 2.828125 2.5625 C 2.296875 2.75 1.65625 2.84375 0.90625 2.84375 C 0.394531 2.84375 -0.03125 2.796875 -0.375 2.703125 C -0.71875 2.609375 -0.972656 2.476562 -1.140625 2.3125 C -1.304688 2.144531 -1.390625 1.957031 -1.390625 1.75 C -1.390625 1.59375 -1.347656 1.425781 -1.265625 1.25 C -1.179688 1.082031 -1.050781 0.921875 -0.875 0.765625 C -0.707031 0.609375 -0.492188 0.457031 -0.234375 0.3125 C 0.015625 0.175781 0.316406 0.0546875 0.671875 -0.046875 L 0.765625 0.171875 C 0.410156 0.359375 0.164062 0.566406 0.03125 0.796875 C -0.101562 1.035156 -0.171875 1.269531 -0.171875 1.5 C -0.171875 1.882812 -0.0351562 2.160156 0.234375 2.328125 C 0.503906 2.503906 0.835938 2.59375 1.234375 2.59375 C 1.554688 2.59375 1.882812 2.539062 2.21875 2.4375 C 2.5625 2.332031 2.878906 2.195312 3.171875 2.03125 C 3.460938 1.863281 3.695312 1.664062 3.875 1.4375 C 4.050781 1.21875 4.140625 0.988281 4.140625 0.75 C 4.140625 0.601562 4.09375 0.503906 4 0.453125 C 3.90625 0.398438 3.75 0.351562 3.53125 0.3125 L 1.3125 -0.265625 C 1.082031 -0.316406 0.894531 -0.410156 0.75 -0.546875 C 0.601562 -0.691406 0.53125 -0.890625 0.53125 -1.140625 C 0.53125 -1.328125 0.597656 -1.519531 0.734375 -1.71875 C 0.867188 -1.925781 1.125 -2.15625 1.5 -2.40625 C 1.875 -2.65625 2.421875 -2.945312 3.140625 -3.28125 Z M 3.890625 -7.421875 C 3.578125 -7.421875 3.3125 -7.332031 3.09375 -7.15625 C 2.882812 -6.976562 2.707031 -6.75 2.5625 -6.46875 C 2.425781 -6.195312 2.320312 -5.910156 2.25 -5.609375 C 2.175781 -5.304688 2.125 -5.03125 2.09375 -4.78125 C 2.0625 -4.53125 2.046875 -4.347656 2.046875 -4.234375 C 2.046875 -3.921875 2.113281 -3.695312 2.25 -3.5625 C 2.394531 -3.425781 2.585938 -3.359375 2.828125 -3.359375 C 3.191406 -3.359375 3.488281 -3.46875 3.71875 -3.6875 C 3.945312 -3.914062 4.125 -4.195312 4.25 -4.53125 C 4.375 -4.863281 4.457031 -5.191406 4.5 -5.515625 C 4.550781 -5.847656 4.578125 -6.125 4.578125 -6.34375 C 4.578125 -6.675781 4.53125 -6.9375 4.4375 -7.125 C 4.351562 -7.320312 4.171875 -7.421875 3.890625 -7.421875 Z M 3.953125 -7.6875 C 4.523438 -7.6875 4.988281 -7.554688 5.34375 -7.296875 C 5.695312 -7.046875 5.875 -6.632812 5.875 -6.0625 C 5.875 -5.59375 5.738281 -5.128906 5.46875 -4.671875 C 5.207031 -4.210938 4.835938 -3.835938 4.359375 -3.546875 C 3.890625 -3.253906 3.328125 -3.109375 2.671875 -3.109375 C 2.140625 -3.109375 1.691406 -3.234375 1.328125 -3.484375 C 0.960938 -3.742188 0.78125 -4.144531 0.78125 -4.6875 C 0.78125 -4.945312 0.835938 -5.25 0.953125 -5.59375 C 1.066406 -5.9375 1.242188 -6.265625 1.484375 -6.578125 C 1.722656 -6.898438 2.046875 -7.164062 2.453125 -7.375 C 2.859375 -7.582031 3.359375 -7.6875 3.953125 -7.6875 Z M 4.984375 -6.9375 L 4.71875 -7.03125 C 4.851562 -7.363281 5.082031 -7.65625 5.40625 -7.90625 C 5.738281 -8.15625 6.085938 -8.28125 6.453125 -8.28125 C 6.703125 -8.28125 6.90625 -8.207031 7.0625 -8.0625 C 7.21875 -7.925781 7.296875 -7.707031 7.296875 -7.40625 C 7.296875 -7.132812 7.226562 -6.9375 7.09375 -6.8125 C 6.957031 -6.6875 6.8125 -6.625 6.65625 -6.625 C 6.5 -6.625 6.347656 -6.675781 6.203125 -6.78125 C 6.066406 -6.882812 5.984375 -7.046875 5.953125 -7.265625 C 5.921875 -7.492188 5.984375 -7.78125 6.140625 -8.125 L 6.328125 -8.078125 C 5.921875 -7.921875 5.628906 -7.757812 5.453125 -7.59375 C 5.285156 -7.425781 5.128906 -7.207031 4.984375 -6.9375 Z M 4.984375 -6.9375 "/></g></g></g></g></g></svg>
  );

  const DualHeader = ({ subtitle }) => (
    <div style={styles.header}>
      <div style={styles.partnerStrip}>
        <div style={styles.logoGroup}>
          <NoctaSvgLogo />
        </div>
        <div style={styles.logoSep}>
          <span style={styles.logoSepIcon}>×</span>
        </div>
        <div style={styles.logoGroup}>
          <div style={styles.boucheronWordmark}>BOUCHERON</div>
        </div>
      </div>
      <div style={styles.exclusiveBadge}>
        <div style={styles.exclusiveLine} />
        <span style={styles.exclusiveText}>Espace dédié · Tarifs préférentiels</span>
        <div style={styles.exclusiveLine} />
      </div>
      <p style={styles.subtitle}>{subtitle}</p>
    </div>
  );

  if (submitted) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <DualHeader subtitle="Commande confirmée" />
          <div style={styles.confirmBox}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.7 }}>✓</div>
            <p style={styles.confirmText}>
              Votre commande a bien été transmise à l'équipe NOCTA.
            </p>
            <p style={{ ...styles.confirmText, opacity: 0.5, marginTop: 8, fontSize: 14 }}>
              Nous reviendrons vers vous sous 24h pour confirmer la disponibilité.
            </p>
            <button
              onClick={() => { setSubmitted(false); setSelected({ proteine: [], veggie: [] }); setQuantities({}); setDate(""); setCommentaire(""); }}
              style={styles.newOrderBtn}
            >
              Nouvelle commande
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderSegment = (label, segment, items) => {
    const count = selected[segment].length;
    const segmentFull = segment === "proteine" ? count >= tier.maxProt : false;
    const globalFull = totalSelected >= tier.varietes;
    const maxLabel = segment === "proteine" ? `${count}/${tier.maxProt} max` : `${count}`;
    return (
      <div style={styles.segment}>
        <div style={styles.segmentHeader}>
          <h2 style={styles.segmentTitle}>{label}</h2>
          <span style={{
            ...styles.badge,
            backgroundColor: count > 0 ? "#1a1a1a" : "transparent",
            color: count > 0 ? "#EEEBE3" : "#1a1a1a",
          }}>
            {maxLabel}
          </span>
        </div>
        <div style={styles.itemList}>
          {items.map((item) => {
            const isSelected = selected[segment].includes(item.id);
            const isFull = (segmentFull || globalFull) && !isSelected;
            return (
              <div
                key={item.id}
                style={{
                  ...styles.itemRow,
                  opacity: isFull ? 0.3 : 1,
                  borderColor: isSelected ? "#1a1a1a" : "rgba(26,26,26,0.08)",
                  backgroundColor: isSelected ? "rgba(26,26,26,0.025)" : "transparent",
                }}
              >
                <div
                  onClick={() => !isFull && toggleItem(segment, item.id)}
                  style={{ ...styles.itemInfo, cursor: isFull ? "default" : "pointer" }}
                >
                  <div style={{
                    ...styles.checkbox,
                    backgroundColor: isSelected ? "#1a1a1a" : "transparent",
                    borderColor: isSelected ? "#1a1a1a" : "rgba(26,26,26,0.25)",
                  }}>
                    {isSelected && <span style={{ color: "#EEEBE3", fontSize: 10, lineHeight: 1 }}>✓</span>}
                  </div>
                  <span style={styles.itemName}>{item.nom}</span>
                </div>
                {isSelected && (
                  <div style={styles.qtyControl}>
                    <button style={styles.qtyBtn} onClick={() => stepQty(item.id, -1)}>−</button>
                    <input
                      type="text"
                      value={quantities[item.id] || 0}
                      readOnly
                      tabIndex={-1}
                      style={styles.qtyInput}
                    />
                    <button style={styles.qtyBtn} onClick={() => stepQty(item.id, 1)}>+</button>
                    <span style={styles.qtyLabel}>pièces</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <DualHeader subtitle="Bon de commande — Cocktail" />

        {alertMessages.length > 0 && (
          <div style={styles.alertBanner}>
            {alertMessages.map((msg, i) => (
              <p key={i} style={styles.alertText}>{msg}</p>
            ))}
          </div>
        )}

        <div style={styles.ruleRow}>
          <span style={styles.ruleTag}>2,90 € HT / pièce</span>
          <span style={styles.ruleDot}>·</span>
          <span style={styles.ruleTag}>Livraison 20 € HT</span>
          <span style={styles.ruleDot}>·</span>
          <span style={styles.ruleTag}>Min. 250 € HT</span>
        </div>

        <div style={styles.instructions}>
          Sélectionnez vos bouchées puis indiquez les quantités par paliers de 10 (min. 20 par variété).
          Le nombre de variétés autorisées dépend du volume total commandé.
        </div>

        <div style={styles.tierInfo}>
          <div style={styles.tierRow}>
            <span style={{...styles.tierTag, ...(totalPieces < 200 ? styles.tierTagActive : {})}}>80–200 pcs → 4 variétés (max 2 prot.)</span>
          </div>
          <div style={styles.tierRow}>
            <span style={{...styles.tierTag, ...(totalPieces >= 200 && totalPieces < 400 ? styles.tierTagActive : {})}}>200–400 pcs → 6 variétés (max 3 prot.)</span>
          </div>
          <div style={styles.tierRow}>
            <span style={{...styles.tierTag, ...(totalPieces >= 400 ? styles.tierTagActive : {})}}>400+ pcs → 8 variétés (max 4 prot.)</span>
          </div>
        </div>

        <div style={styles.dateRow}>
          <label style={styles.fieldLabel}>Date souhaitée</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={dateMinimum} style={styles.dateInput} />
        </div>

        {renderSegment("Bouchées protéinées", "proteine", CATALOGUE.proteine)}
        {renderSegment("Bouchées végétariennes", "veggie", CATALOGUE.veggie)}

        <div style={styles.commentSection}>
          <label style={styles.fieldLabel}>Commentaire (optionnel)</label>
          <textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Allergies, précisions logistiques…"
            style={styles.textarea}
            rows={3}
          />
        </div>

        <div style={styles.recap}>
          <h3 style={styles.recapTitle}>Récapitulatif</h3>
          {[...selected.proteine, ...selected.veggie].length > 0 ? (
            <div style={styles.recapLines}>
              {[...selected.proteine, ...selected.veggie].map((id) => (
                <div key={id} style={styles.recapLine}>
                  <span style={styles.recapItemName}>{getItemName(id)}</span>
                  <span style={styles.recapItemQty}>
                    {quantities[id] || 0} × {fmt(PRIX_UNITAIRE)} = {fmt((quantities[id] || 0) * PRIX_UNITAIRE)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ ...styles.recapItemName, opacity: 0.35, fontStyle: "italic" }}>
              Sélectionnez vos bouchées ci-dessus
            </p>
          )}

          <div style={styles.divider} />

          <div style={styles.totalRow}>
            <span>Sous-total ({totalPieces} pièces)</span>
            <span>{fmt(sousTotal)}</span>
          </div>
          <div style={styles.totalRow}>
            <span>Livraison</span>
            <span>{fmt(FRAIS_LIVRAISON)}</span>
          </div>
          <div style={{ ...styles.totalRow, fontWeight: 600 }}>
            <span>Total HT</span>
            <span>{fmt(totalHT)}</span>
          </div>
          <div style={styles.totalRow}>
            <span>TVA 10 %</span>
            <span>{fmt(montantTVA)}</span>
          </div>
          <div style={{ ...styles.divider, marginTop: 14 }} />
          <div style={{ ...styles.totalRow, marginTop: 14, fontSize: 18, fontWeight: 700, letterSpacing: "0.02em" }}>
            <span>Total TTC</span>
            <span>{fmt(totalTTC)}</span>
          </div>

          {!minimumOk && totalPieces > 0 && (
            <p style={styles.warning}>
              Minimum de commande : 250,00 € HT — il manque {fmt(MINIMUM_HT - totalHT)}
            </p>
          )}
          {!selectionComplete && (
            <p style={{ ...styles.warning, backgroundColor: "rgba(26,26,26,0.04)", borderColor: "rgba(26,26,26,0.1)", color: "#1a1a1a" }}>
              Sélectionnez au moins 4 variétés pour valider — {totalSelected}/4 actuellement
            </p>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            ...styles.submitBtn,
            opacity: canSubmit ? 1 : 0.3,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          Transmettre la commande
        </button>

        <p style={styles.footerText}>
          NOCTA · H+E Catering SARL · Courbevoie
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#EEEBE3",
    fontFamily: "'Cormorant Garamond', 'Georgia', serif",
    color: "#1a1a1a",
    padding: "48px 16px 64px",
  },
  container: { maxWidth: 620, margin: "0 auto" },
  header: { textAlign: "center", marginBottom: 8 },
  partnerStrip: {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 24, marginBottom: 20, flexWrap: "wrap",
  },
  logoGroup: { display: "flex", alignItems: "center", gap: 10 },
  logoSep: { display: "flex", alignItems: "center" },
  logoSepIcon: { fontSize: 14, opacity: 0.25, fontFamily: "'DM Sans', sans-serif", fontWeight: 300 },
  boucheronWordmark: {
    fontSize: 20, fontWeight: 400, letterSpacing: "0.28em",
    textTransform: "uppercase", fontFamily: "'Cormorant Garamond', serif",
  },
  exclusiveBadge: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 12,
  },
  exclusiveLine: { height: 1, width: 40, backgroundColor: "rgba(26,26,26,0.15)" },
  exclusiveText: {
    fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
    letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.45,
  },
  subtitle: {
    fontSize: 15, fontWeight: 400, opacity: 0.45, letterSpacing: "0.04em",
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", margin: "0 0 8px",
  },
  ruleRow: {
    display: "flex", justifyContent: "center", alignItems: "center",
    gap: 8, flexWrap: "wrap", marginBottom: 24,
  },
  ruleTag: {
    fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
    letterSpacing: "0.03em", padding: "4px 10px",
    border: "1px solid rgba(26,26,26,0.12)", borderRadius: 2,
  },
  ruleDot: { opacity: 0.2, fontSize: 14 },
  instructions: {
    fontSize: 13, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6,
    opacity: 0.5, textAlign: "center", marginBottom: 28, padding: "0 20px",
  },
  dateRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid rgba(26,26,26,0.08)",
  },
  fieldLabel: {
    fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, letterSpacing: "0.02em",
  },
  dateInput: {
    fontSize: 13, fontFamily: "'DM Sans', sans-serif", padding: "8px 12px",
    border: "1px solid rgba(26,26,26,0.15)", borderRadius: 2,
    backgroundColor: "transparent", color: "#1a1a1a", outline: "none",
  },
  segment: { marginBottom: 32 },
  segmentHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14,
  },
  segmentTitle: { fontSize: 19, fontWeight: 600, fontStyle: "italic", margin: 0 },
  badge: {
    fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
    letterSpacing: "0.06em", padding: "3px 10px",
    border: "1px solid #1a1a1a", borderRadius: 2, transition: "all 0.2s ease",
  },
  itemList: { display: "flex", flexDirection: "column", gap: 6 },
  itemRow: {
    display: "flex", flexDirection: "column", padding: "13px 16px",
    border: "1px solid rgba(26,26,26,0.08)", borderRadius: 2, transition: "all 0.15s ease",
  },
  itemInfo: { display: "flex", alignItems: "flex-start", gap: 12 },
  checkbox: {
    width: 17, height: 17, minWidth: 17, border: "1.5px solid rgba(26,26,26,0.25)",
    borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center",
    marginTop: 2, transition: "all 0.15s ease",
  },
  itemName: { fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 400, lineHeight: 1.5 },
  qtyControl: {
    display: "flex", alignItems: "center", gap: 6, marginTop: 12, marginLeft: 29,
  },
  qtyBtn: {
    width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
    border: "1px solid rgba(26,26,26,0.15)", borderRadius: 2,
    backgroundColor: "transparent", fontSize: 15, fontWeight: 600,
    cursor: "pointer", color: "#1a1a1a", fontFamily: "'DM Sans', sans-serif",
  },
  qtyInput: {
    width: 68, textAlign: "center", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
    fontWeight: 600, padding: "5px 4px", border: "1px solid rgba(26,26,26,0.15)",
    borderRadius: 2, backgroundColor: "transparent", color: "#1a1a1a", outline: "none",
  },
  qtyLabel: { fontSize: 11, fontFamily: "'DM Sans', sans-serif", opacity: 0.4, marginLeft: 2 },
  commentSection: { marginBottom: 28 },
  textarea: {
    width: "100%", marginTop: 8, fontSize: 13, fontFamily: "'DM Sans', sans-serif",
    padding: "10px 12px", border: "1px solid rgba(26,26,26,0.15)", borderRadius: 2,
    backgroundColor: "transparent", color: "#1a1a1a", outline: "none",
    resize: "vertical", boxSizing: "border-box",
  },
  recap: {
    padding: "22px", backgroundColor: "rgba(26,26,26,0.025)",
    border: "1px solid rgba(26,26,26,0.08)", borderRadius: 2, marginBottom: 20,
  },
  recapTitle: {
    fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
    fontFamily: "'DM Sans', sans-serif", margin: "0 0 14px",
  },
  recapLines: { display: "flex", flexDirection: "column", gap: 8 },
  recapLine: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  recapItemName: { fontSize: 12, fontFamily: "'DM Sans', sans-serif", flex: 1, lineHeight: 1.4 },
  recapItemQty: { fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, whiteSpace: "nowrap" },
  divider: { height: 1, backgroundColor: "rgba(26,26,26,0.08)", margin: "14px 0" },
  totalRow: {
    display: "flex", justifyContent: "space-between", fontSize: 13,
    fontFamily: "'DM Sans', sans-serif", marginBottom: 5,
  },
  warning: {
    marginTop: 14, fontSize: 12, fontFamily: "'DM Sans', sans-serif",
    color: "#8B4513", fontWeight: 500, padding: "8px 12px",
    backgroundColor: "rgba(139,69,19,0.05)", borderRadius: 2,
    border: "1px solid rgba(139,69,19,0.1)", lineHeight: 1.5,
  },
  submitBtn: {
    width: "100%", padding: "15px", backgroundColor: "#1a1a1a", color: "#EEEBE3",
    fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
    letterSpacing: "0.14em", textTransform: "uppercase",
    border: "none", borderRadius: 2, transition: "opacity 0.2s ease",
  },
  footerText: {
    textAlign: "center", marginTop: 28, fontSize: 11,
    fontFamily: "'DM Sans', sans-serif", opacity: 0.25, letterSpacing: "0.06em",
  },
  alertBanner: {
    backgroundColor: "#8B1A1A", color: "#fff", padding: "14px 18px",
    borderRadius: 2, marginBottom: 20, lineHeight: 1.6,
  },
  alertText: {
    fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
    margin: "0 0 4px",
  },
  tierInfo: {
    display: "flex", flexDirection: "column", gap: 4,
    marginBottom: 24, alignItems: "center",
  },
  tierRow: { display: "flex" },
  tierTag: {
    fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 400,
    letterSpacing: "0.02em", padding: "3px 10px",
    border: "1px solid rgba(26,26,26,0.08)", borderRadius: 2,
    opacity: 0.4, transition: "all 0.2s ease",
  },
  tierTagActive: {
    opacity: 1, fontWeight: 600,
    border: "1px solid #1a1a1a", backgroundColor: "rgba(26,26,26,0.04)",
  },
  confirmBox: {
    textAlign: "center", padding: "56px 24px",
    backgroundColor: "rgba(26,26,26,0.025)", border: "1px solid rgba(26,26,26,0.08)", borderRadius: 2,
  },
  confirmText: { fontSize: 16, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, margin: 0 },
  newOrderBtn: {
    marginTop: 28, padding: "11px 28px", backgroundColor: "transparent", color: "#1a1a1a",
    fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
    letterSpacing: "0.1em", textTransform: "uppercase",
    border: "1.5px solid #1a1a1a", borderRadius: 2, cursor: "pointer", transition: "all 0.2s ease",
  },
};
