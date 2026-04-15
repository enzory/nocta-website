import { useState, useMemo } from "react";

const PRIX_UNITAIRE = 2.9;
const FRAIS_LIVRAISON = 20.0;
const TVA = 0.1;
const MINIMUM_HT = 250.0;
const REQUIRED_PROTEINE = 2;
const REQUIRED_VEGGIE = 2;

const CATALOGUE = {
  proteine: [
    { id: "p1", nom: "Pic courgette en violon, mozzarella et crevette" },
    { id: "p2", nom: "Trident saumon, gel de citron vert, laquage aigre-doux, cébette et sésame" },
    { id: "p3", nom: "Pic estival : pêche, mozzarella, basilic et jambon" },
    { id: "p4", nom: "Bouchée : gressin et charcuterie (enroulé)" },
    { id: "p5", nom: "Finger : sablé au parmesan, rillettes de canard à l'orange et piment d'Espelette" },
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

  const toggleItem = (segment, id) => {
    setSelected((prev) => {
      const current = prev[segment];
      const max = segment === "proteine" ? REQUIRED_PROTEINE : REQUIRED_VEGGIE;
      if (current.includes(id)) {
        const next = current.filter((x) => x !== id);
        setQuantities((q) => { const nq = { ...q }; delete nq[id]; return nq; });
        return { ...prev, [segment]: next };
      }
      if (current.length >= max) return prev;
      return { ...prev, [segment]: [...current, id] };
    });
  };

  const setQty = (id, val) => {
    const n = Math.max(0, parseInt(val) || 0);
    setQuantities((q) => ({ ...q, [id]: n }));
  };

  const totalPieces = useMemo(
    () => Object.values(quantities).reduce((s, v) => s + v, 0),
    [quantities]
  );
  const sousTotal = totalPieces * PRIX_UNITAIRE;
  const totalHT = sousTotal + FRAIS_LIVRAISON;
  const montantTVA = totalHT * TVA;
  const totalTTC = totalHT + montantTVA;

  const selectionComplete =
    selected.proteine.length === REQUIRED_PROTEINE &&
    selected.veggie.length === REQUIRED_VEGGIE;
  const allHaveQty = [...selected.proteine, ...selected.veggie].every(
    (id) => (quantities[id] || 0) > 0
  );
  const minimumOk = totalHT >= MINIMUM_HT;
  const canSubmit = selectionComplete && allHaveQty && minimumOk;

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

  const handleSubmit = async () => {
    const body = buildRecap();
    try {
      await fetch("https://formspree.io/f/maqpwebj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _subject: `Commande Boucheron — ${date || "Sans date"}`,
          message: body,
          _replyto: "myriana@boucheron.com",
        }),
      });
      setSubmitted(true);
    } catch {
      alert("Erreur lors de l'envoi. Veuillez réessayer.");
    }
  };

  /* ── Dual Logo Header ── */
  const DualHeader = ({ subtitle }) => (
    <div style={styles.header}>
      <div style={styles.partnerStrip}>
        <div style={styles.logoGroup}>
          <div style={styles.noctaLogoBox}>N</div>
          <div style={styles.noctaWordmark}>NOCTA</div>
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

  const renderSegment = (label, segment, required, items) => {
    const count = selected[segment].length;
    return (
      <div style={styles.segment}>
        <div style={styles.segmentHeader}>
          <h2 style={styles.segmentTitle}>{label}</h2>
          <span style={{
            ...styles.badge,
            backgroundColor: count === required ? "#1a1a1a" : "transparent",
            color: count === required ? "#EEEBE3" : "#1a1a1a",
          }}>
            {count}/{required}
          </span>
        </div>
        <div style={styles.itemList}>
          {items.map((item) => {
            const isSelected = selected[segment].includes(item.id);
            const isFull = count >= required && !isSelected;
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
                    <button style={styles.qtyBtn} onClick={() => setQty(item.id, (quantities[item.id] || 0) - 10)}>−</button>
                    <input
                      type="number"
                      value={quantities[item.id] || ""}
                      onChange={(e) => setQty(item.id, e.target.value)}
                      placeholder="0"
                      style={styles.qtyInput}
                      min="0"
                      step="10"
                    />
                    <button style={styles.qtyBtn} onClick={() => setQty(item.id, (quantities[item.id] || 0) + 10)}>+</button>
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

        <div style={styles.ruleRow}>
          <span style={styles.ruleTag}>2,90 € HT / pièce</span>
          <span style={styles.ruleDot}>·</span>
          <span style={styles.ruleTag}>Livraison 20 € HT</span>
          <span style={styles.ruleDot}>·</span>
          <span style={styles.ruleTag}>Min. 250 € HT</span>
        </div>

        <div style={styles.instructions}>
          Sélectionnez exactement 2 bouchées protéinées et 2 bouchées végétariennes, puis indiquez les quantités souhaitées.
        </div>

        <div style={styles.dateRow}>
          <label style={styles.fieldLabel}>Date souhaitée</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.dateInput} />
        </div>

        {renderSegment("Bouchées protéinées", "proteine", REQUIRED_PROTEINE, CATALOGUE.proteine)}
        {renderSegment("Bouchées végétariennes", "veggie", REQUIRED_VEGGIE, CATALOGUE.veggie)}

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
              Sélectionnez 2 protéinées et 2 végétariennes pour valider
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
  noctaLogoBox: {
    width: 36, height: 36, border: "1.5px solid #1a1a1a",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 17, fontWeight: 700, letterSpacing: "0.05em",
    fontFamily: "'Cormorant Garamond', serif",
  },
  noctaWordmark: {
    fontSize: 22, fontWeight: 700, letterSpacing: "0.18em",
    textTransform: "uppercase", fontFamily: "'Cormorant Garamond', serif",
  },
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
