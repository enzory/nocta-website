import { useMemo, useState } from 'react';

type MenuItem = {
  id: string;
  nom: string;
  description?: string;
  image?: string;
  tags?: string[];
  allergenes?: string[];
};

type MenuData = {
  semaine: { numero: number; debut: string; fin: string; label: string };
  entrees: MenuItem[];
  plats: MenuItem[];
  desserts: MenuItem[];
  tarifs: {
    entree: number;
    plat: number;
    dessert: number;
    livraison_paris: number;
    minimum_commande: number;
  };
};

type Plateau = {
  uid: string;
  entreeId: string | '';
  platId: string | '';
  dessertId: string | '';
  qte: number;
};

const TVA = 0.10;
const FORMSPREE = 'https://formspree.io/f/maqpwebj';

const fmt = (n: number) => n.toFixed(2).replace('.', ',') + ' €';

// J+3 calendaires : NOCTA livre 7j/7, week-end inclus.
const computeMinDate = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
};

const isParisCP = (cp: string): 'paris' | 'horsParis' | 'unknown' => {
  if (!/^\d{5}$/.test(cp)) return 'unknown';
  if (!cp.startsWith('75')) return 'horsParis';
  const arr = parseInt(cp.slice(2), 10);
  return arr >= 1 && arr <= 20 ? 'paris' : 'horsParis';
};

const newPlateau = (): Plateau => ({
  uid: Math.random().toString(36).slice(2, 9),
  entreeId: '',
  platId: '',
  dessertId: '',
  qte: 1,
});

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export default function Configurateur({ menu }: { menu: MenuData }) {
  const dateMin = useMemo(computeMinDate, []);
  const tarifs = menu.tarifs;

  const [plateaux, setPlateaux] = useState<Plateau[]>([newPlateau()]);
  const [dateLivraison, setDateLivraison] = useState('');
  const [rue, setRue] = useState('');
  const [codePostal, setCodePostal] = useState('');
  const [ville, setVille] = useState('');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [entreprise, setEntreprise] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [commentaires, setCommentaires] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Helpers catalogues ────────────────────────────────────────────────
  const findItem = (list: MenuItem[], id: string) => list.find((i) => i.id === id);
  const itemNom = (list: MenuItem[], id: string) => findItem(list, id)?.nom || '';

  // ── Plateau actions ───────────────────────────────────────────────────
  const addPlateau = () => setPlateaux((p) => [...p, newPlateau()]);
  const removePlateau = (uid: string) =>
    setPlateaux((p) => (p.length === 1 ? p : p.filter((x) => x.uid !== uid)));
  const updatePlateau = (uid: string, patch: Partial<Plateau>) =>
    setPlateaux((p) => p.map((x) => (x.uid === uid ? { ...x, ...patch } : x)));

  // ── Calculs ───────────────────────────────────────────────────────────
  const platLineTotal = (pl: Plateau) => {
    let n = 0;
    if (pl.entreeId) n += tarifs.entree;
    if (pl.platId) n += tarifs.plat;
    if (pl.dessertId) n += tarifs.dessert;
    return n * Math.max(0, pl.qte);
  };

  const sousTotalHT = plateaux.reduce((s, pl) => s + platLineTotal(pl), 0);
  const zone = isParisCP(codePostal);
  const livraisonHT = zone === 'paris' ? tarifs.livraison_paris : 0;
  const totalHT = sousTotalHT + livraisonHT;
  const tva = totalHT * TVA;
  const totalTTC = totalHT + tva;

  // ── Validation ────────────────────────────────────────────────────────
  const allHaveDate = dateLivraison !== '' && dateLivraison >= dateMin;
  const allHaveAddress = rue.trim() !== '' && codePostal.trim() !== '' && ville.trim() !== '';
  const allHaveContact =
    prenom.trim() !== '' &&
    nom.trim() !== '' &&
    isEmail(email) &&
    telephone.trim() !== '';
  const allPlateauxHavePlat = plateaux.every((pl) => pl.platId !== '');
  const minOk = totalHT >= tarifs.minimum_commande;
  const zoneOk = zone === 'paris';

  const canSubmit =
    allHaveDate &&
    allHaveAddress &&
    allHaveContact &&
    allPlateauxHavePlat &&
    minOk &&
    zoneOk &&
    !submitting;

  // ── Récap text ────────────────────────────────────────────────────────
  const buildRecap = () => {
    const lines: string[] = [];
    lines.push('NOUVELLE DEMANDE — PLATEAUX REPAS');
    lines.push(`Semaine du menu : ${menu.semaine.label}`);
    lines.push('');
    lines.push('— PLATEAUX —');
    plateaux.forEach((pl, idx) => {
      const entree = pl.entreeId ? itemNom(menu.entrees, pl.entreeId) : '—';
      const plat = pl.platId ? itemNom(menu.plats, pl.platId) : '—';
      const dessert = pl.dessertId ? itemNom(menu.desserts, pl.dessertId) : '—';
      const total = platLineTotal(pl);
      lines.push(`Plateau ${idx + 1} × ${pl.qte} (${fmt(total)})`);
      lines.push(`  Entrée  : ${entree}`);
      lines.push(`  Plat    : ${plat}`);
      lines.push(`  Dessert : ${dessert}`);
    });
    lines.push('');
    lines.push('— LIVRAISON —');
    lines.push(`Date souhaitée : ${dateLivraison}`);
    lines.push(`Adresse        : ${rue}, ${codePostal} ${ville}`);
    lines.push(`Zone           : Paris intra-muros`);
    lines.push('');
    lines.push('— CONTACT —');
    lines.push(`Nom        : ${prenom} ${nom}`);
    lines.push(`Entreprise : ${entreprise || '—'}`);
    lines.push(`Email      : ${email}`);
    lines.push(`Téléphone  : ${telephone}`);
    lines.push('');
    lines.push('— TOTAUX —');
    lines.push(`Sous-total HT : ${fmt(sousTotalHT)}`);
    lines.push(`Livraison HT  : ${fmt(livraisonHT)}`);
    lines.push(`Total HT      : ${fmt(totalHT)}`);
    lines.push(`TVA 10 %      : ${fmt(tva)}`);
    lines.push(`Total TTC     : ${fmt(totalTTC)}`);
    if (commentaires.trim()) {
      lines.push('');
      lines.push('— COMMENTAIRES —');
      lines.push(commentaires.trim());
    }
    return lines.join('\n');
  };

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(FORMSPREE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: `Plateaux repas — ${prenom} ${nom} (${entreprise || 'particulier'}) — ${dateLivraison}`,
          _replyto: email,
          message: buildRecap(),
          email,
          prenom,
          nom,
          entreprise,
          telephone,
          dateLivraison,
          adresse: `${rue}, ${codePostal} ${ville}`,
          totalHT: fmt(totalHT),
          totalTTC: fmt(totalTTC),
        }),
      });
      if (!res.ok) throw new Error('Réponse non OK');
      setSubmitted(true);
    } catch {
      setSubmitError("Erreur lors de l'envoi. Merci de réessayer ou de nous écrire à contact@noctaparis.fr.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────
  const reset = () => {
    setPlateaux([newPlateau()]);
    setDateLivraison('');
    setRue('');
    setCodePostal('');
    setVille('');
    setPrenom('');
    setNom('');
    setEntreprise('');
    setEmail('');
    setTelephone('');
    setCommentaires('');
    setSubmitted(false);
    setSubmitError(null);
  };

  // ── Confirmation ──────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="bg-nocta-cream border border-nocta-black/15 p-10 lg:p-16 text-center max-w-3xl mx-auto">
        <div className="font-serif text-5xl text-nocta-black/40 mb-6">✓</div>
        <h3 className="font-serif text-2xl md:text-3xl font-light italic text-nocta-black leading-tight mb-4">
          Demande envoyée.
        </h3>
        <p className="font-sans text-sm font-light text-nocta-grey leading-relaxed max-w-xl mx-auto mb-8">
          Nous revenons vers vous sous 24h ouvrées pour valider la disponibilité
          et confirmer la commande.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center font-sans text-sm font-light tracking-widest uppercase border border-nocta-black text-nocta-black px-8 py-3 transition-all duration-300 hover:bg-nocta-black hover:text-nocta-cream"
        >
          Nouvelle demande
        </button>
      </div>
    );
  }

  // ── Styles helpers (Tailwind classes regroupées) ─────────────────────
  const inputBase =
    'w-full bg-transparent border border-nocta-black/15 px-4 py-3 font-sans text-sm font-light text-nocta-black placeholder:text-nocta-grey/60 focus:outline-none focus:border-nocta-black transition-colors';
  const labelBase = 'block font-sans text-xs tracking-[0.2em] uppercase text-nocta-grey mb-2';

  const renderSelect = (
    pl: Plateau,
    field: 'entreeId' | 'platId' | 'dessertId',
    list: MenuItem[],
    label: string,
    prix: number,
    optional: boolean,
  ) => (
    <div>
      <label className={labelBase}>
        {label} <span className="normal-case tracking-normal text-nocta-grey/60">— {prix} € HT</span>
        {!optional && <span className="text-nocta-black"> *</span>}
      </label>
      <select
        value={pl[field]}
        onChange={(e) => updatePlateau(pl.uid, { [field]: e.target.value } as Partial<Plateau>)}
        className={inputBase + ' appearance-none cursor-pointer'}
      >
        <option value="">{optional ? 'Aucun' : 'Sélectionnez…'}</option>
        {list.map((it) => (
          <option key={it.id} value={it.id}>{it.nom}</option>
        ))}
      </select>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-12">

      {/* ── Colonne gauche : sélection ───────────────────────────────── */}
      <div className="lg:col-span-3 flex flex-col gap-12">

        {/* Plateaux */}
        <div>
          <div className="flex items-baseline justify-between mb-6">
            <h3 className="font-serif text-xl md:text-2xl font-light italic text-nocta-black">
              Vos plateaux
            </h3>
            <span className="font-sans text-xs tracking-[0.2em] uppercase text-nocta-grey">
              {plateaux.length} plateau{plateaux.length > 1 ? 'x' : ''}
            </span>
          </div>

          <div className="flex flex-col gap-6">
            {plateaux.map((pl, idx) => (
              <div key={pl.uid} className="border border-nocta-black/15 p-6 lg:p-8 bg-nocta-cream">
                <div className="flex items-center justify-between mb-6">
                  <p className="font-sans text-xs tracking-[0.4em] uppercase text-nocta-grey">
                    Plateau {String(idx + 1).padStart(2, '0')}
                  </p>
                  {plateaux.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePlateau(pl.uid)}
                      className="font-sans text-xs tracking-widest uppercase text-nocta-grey hover:text-nocta-black transition-colors"
                      aria-label={`Supprimer le plateau ${idx + 1}`}
                    >
                      Supprimer
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                  {renderSelect(pl, 'entreeId', menu.entrees, 'Entrée', tarifs.entree, true)}
                  {renderSelect(pl, 'platId', menu.plats, 'Plat', tarifs.plat, false)}
                  {renderSelect(pl, 'dessertId', menu.desserts, 'Dessert', tarifs.dessert, true)}
                </div>

                <div className="flex items-end justify-between gap-4">
                  <div className="w-32">
                    <label className={labelBase}>Quantité</label>
                    <input
                      type="number"
                      min={1}
                      value={pl.qte}
                      onChange={(e) =>
                        updatePlateau(pl.uid, { qte: Math.max(1, parseInt(e.target.value || '1', 10)) })
                      }
                      className={inputBase}
                    />
                  </div>
                  <p className="font-serif text-xl italic text-nocta-black">
                    {fmt(platLineTotal(pl))}
                  </p>
                </div>
                <p className="font-sans text-xs font-light text-nocta-grey/80 leading-relaxed mt-3">
                  Pour plusieurs plateaux identiques, indiquez la quantité ici. Pour des plateaux
                  différents, ajoutez un nouveau plateau ci-dessous.
                </p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addPlateau}
            className="mt-6 inline-flex items-center gap-3 font-sans text-sm font-light tracking-widest uppercase text-nocta-black border border-nocta-black/30 px-6 py-3 transition-all duration-300 hover:border-nocta-black hover:bg-nocta-black hover:text-nocta-cream"
          >
            <span className="text-base leading-none">+</span> Ajouter un plateau
          </button>
        </div>

        {/* Livraison */}
        <div>
          <h3 className="font-serif text-xl md:text-2xl font-light italic text-nocta-black mb-6">
            Livraison
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelBase}>Date de livraison <span className="text-nocta-black">*</span></label>
              <input
                type="date"
                value={dateLivraison}
                min={dateMin}
                onChange={(e) => setDateLivraison(e.target.value)}
                className={inputBase}
              />
              <p className="font-sans text-xs font-light text-nocta-grey/80 mt-2">
                Délai minimum : J+3, livraison 7j/7.
              </p>
            </div>

            <div>
              <label className={labelBase}>Code postal <span className="text-nocta-black">*</span></label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                placeholder="75001"
                value={codePostal}
                onChange={(e) => setCodePostal(e.target.value.replace(/\D/g, '').slice(0, 5))}
                className={inputBase}
              />
              {codePostal.length === 5 && zone === 'horsParis' && (
                <p className="font-sans text-xs font-light text-nocta-black/70 mt-2">
                  Hors Paris intra-muros : nous consulter à <a href="mailto:contact@noctaparis.fr" className="underline">contact@noctaparis.fr</a>.
                </p>
              )}
              {zone === 'paris' && (
                <p className="font-sans text-xs font-light text-nocta-grey/80 mt-2">
                  Paris intra-muros — livraison {tarifs.livraison_paris} € HT.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className={labelBase}>Rue <span className="text-nocta-black">*</span></label>
              <input
                type="text"
                placeholder="12 rue de la Paix"
                value={rue}
                onChange={(e) => setRue(e.target.value)}
                className={inputBase}
              />
            </div>
            <div>
              <label className={labelBase}>Ville <span className="text-nocta-black">*</span></label>
              <input
                type="text"
                placeholder="Paris"
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                className={inputBase}
              />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div>
          <h3 className="font-serif text-xl md:text-2xl font-light italic text-nocta-black mb-6">
            Vos coordonnées
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelBase}>Prénom <span className="text-nocta-black">*</span></label>
              <input type="text" value={prenom} onChange={(e) => setPrenom(e.target.value)} className={inputBase} />
            </div>
            <div>
              <label className={labelBase}>Nom <span className="text-nocta-black">*</span></label>
              <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} className={inputBase} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelBase}>Entreprise</label>
              <input type="text" value={entreprise} onChange={(e) => setEntreprise(e.target.value)} className={inputBase} />
            </div>
            <div>
              <label className={labelBase}>Téléphone <span className="text-nocta-black">*</span></label>
              <input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} className={inputBase} />
            </div>
          </div>

          <div className="mb-4">
            <label className={labelBase}>Email <span className="text-nocta-black">*</span></label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputBase} />
          </div>

          <div>
            <label className={labelBase}>Commentaires</label>
            <textarea
              rows={3}
              value={commentaires}
              onChange={(e) => setCommentaires(e.target.value)}
              placeholder="Allergies, étage, code d'accès, instructions particulières…"
              className={inputBase + ' resize-none'}
            />
          </div>
        </div>
      </div>

      {/* ── Colonne droite : récap sticky ───────────────────────────── */}
      <aside className="lg:col-span-2">
        <div className="lg:sticky lg:top-24 bg-nocta-cream border border-nocta-black/15 p-6 lg:p-8">
          <p className="font-sans text-xs tracking-[0.4em] uppercase text-nocta-grey mb-6">Votre commande</p>

          <div className="flex flex-col gap-3 mb-6">
            <div className="flex items-baseline justify-between">
              <span className="font-sans text-sm font-light text-nocta-grey">Sous-total HT</span>
              <span className="font-sans text-sm text-nocta-black tabular-nums">{fmt(sousTotalHT)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-sans text-sm font-light text-nocta-grey">
                Livraison{zone === 'paris' ? '' : zone === 'horsParis' ? ' (hors Paris)' : ''}
              </span>
              <span className="font-sans text-sm text-nocta-black tabular-nums">
                {zone === 'paris' ? fmt(livraisonHT) : zone === 'horsParis' ? 'sur devis' : '—'}
              </span>
            </div>
            <div className="border-t border-nocta-black/10 pt-3 flex items-baseline justify-between">
              <span className="font-sans text-sm font-medium text-nocta-black">Total HT</span>
              <span className="font-serif text-xl italic text-nocta-black tabular-nums">{fmt(totalHT)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-sans text-xs font-light text-nocta-grey">TVA 10 %</span>
              <span className="font-sans text-xs font-light text-nocta-grey tabular-nums">{fmt(tva)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-sans text-xs tracking-widest uppercase text-nocta-grey">Total TTC</span>
              <span className="font-sans text-xs text-nocta-black tabular-nums">{fmt(totalTTC)}</span>
            </div>
          </div>

          {!minOk && (
            <p className="font-sans text-xs font-light text-nocta-black/80 leading-relaxed border-t border-nocta-black/10 pt-4 mb-4">
              Minimum de commande : {tarifs.minimum_commande} € HT.
              Il manque {fmt(Math.max(0, tarifs.minimum_commande - totalHT))} pour valider.
            </p>
          )}

          {!zoneOk && codePostal.length === 5 && (
            <p className="font-sans text-xs font-light text-nocta-black/80 leading-relaxed border-t border-nocta-black/10 pt-4 mb-4">
              Pour livraison hors Paris, contactez-nous directement à <a href="mailto:contact@noctaparis.fr" className="underline">contact@noctaparis.fr</a>.
            </p>
          )}

          {submitError && (
            <p className="font-sans text-xs font-light text-nocta-black/80 leading-relaxed border-t border-nocta-black/10 pt-4 mb-4">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full inline-flex items-center justify-center font-sans text-sm font-light tracking-widest uppercase px-6 py-4 transition-all duration-300 ${
              canSubmit
                ? 'bg-nocta-black text-nocta-cream hover:bg-nocta-black/85'
                : 'bg-nocta-black/20 text-nocta-black/40 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Envoi en cours…' : 'Envoyer ma demande'}
          </button>

          <p className="font-sans text-xs font-light text-nocta-grey/80 leading-relaxed mt-4">
            Validation manuelle sous 24h ouvrées. Pas de paiement à cette étape.
          </p>
        </div>
      </aside>

    </form>
  );
}
