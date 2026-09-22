// src/data/maillage.ts
// Maillage interne des pages /traiteur/* — source unique, relue à la main.
// Règle : 4 voisins par page (proximité géographique, puis même type de prestation),
// + 1 article du Journal. Chaque page reçoit au moins 3 liens de ses voisines.
// Ajouter une page GEO = ajouter une entrée ici ET la citer chez au moins 3 voisines.

export const maillage: Record<string, { voisins: string[]; article: string }> = {
  "traiteur-paris-1": { voisins: ["traiteur-paris-2", "traiteur-paris-3", "traiteur-paris-4", "traiteur-paris-8"], article: "budget-traiteur-paris" },
  "traiteur-paris-2": { voisins: ["traiteur-paris-1", "traiteur-paris-3", "traiteur-paris-9", "traiteur-paris-8"], article: "budget-traiteur-paris" },
  "traiteur-paris-3": { voisins: ["traiteur-paris-4", "traiteur-paris-2", "traiteur-paris-1", "traiteur-paris-9"], article: "budget-traiteur-paris" },
  "traiteur-paris-4": { voisins: ["traiteur-paris-3", "traiteur-paris-1", "traiteur-paris-6", "traiteur-paris-2"], article: "budget-traiteur-paris" },
  "traiteur-paris-6": { voisins: ["traiteur-paris-7", "traiteur-paris-15", "traiteur-paris-4", "traiteur-paris-1"], article: "sommelier-evenement" },
  "traiteur-paris-7": { voisins: ["traiteur-paris-6", "traiteur-paris-15", "traiteur-paris-16", "chef-prive-paris-7"], article: "sommelier-evenement" },
  "traiteur-paris-8": { voisins: ["traiteur-paris-17", "traiteur-paris-9", "traiteur-paris-16", "chef-prive-paris-8"], article: "cocktail-dinatoire-traiteur-paris" },
  "traiteur-paris-9": { voisins: ["traiteur-paris-8", "traiteur-paris-2", "traiteur-paris-17", "traiteur-paris-3"], article: "budget-traiteur-paris" },
  "traiteur-paris-15": { voisins: ["traiteur-paris-7", "traiteur-paris-6", "traiteur-paris-16", "traiteur-boulogne-billancourt"], article: "sommelier-evenement" },
  "traiteur-paris-16": { voisins: ["traiteur-paris-17", "traiteur-paris-15", "traiteur-boulogne-billancourt", "chef-prive-paris-16"], article: "sommelier-evenement" },
  "traiteur-paris-17": { voisins: ["traiteur-paris-8", "traiteur-paris-16", "traiteur-levallois-perret", "traiteur-neuilly-sur-seine"], article: "cocktail-dinatoire-traiteur-paris" },
  "traiteur-levallois-perret": { voisins: ["traiteur-neuilly-sur-seine", "traiteur-paris-17", "traiteur-courbevoie-la-defense", "traiteur-puteaux"], article: "traiteur-la-defense" },
  "traiteur-neuilly-sur-seine": { voisins: ["traiteur-levallois-perret", "traiteur-courbevoie-la-defense", "traiteur-puteaux", "chef-prive-neuilly-sur-seine"], article: "chef-prive-domicile-paris" },
  "traiteur-courbevoie-la-defense": { voisins: ["traiteur-puteaux", "traiteur-levallois-perret", "traiteur-neuilly-sur-seine", "traiteur-cocktail-entreprise-paris"], article: "traiteur-la-defense" },
  "traiteur-puteaux": { voisins: ["traiteur-courbevoie-la-defense", "traiteur-neuilly-sur-seine", "traiteur-boulogne-billancourt", "traiteur-seminaire-paris"], article: "traiteur-la-defense" },
  "traiteur-boulogne-billancourt": { voisins: ["traiteur-paris-16", "traiteur-paris-15", "traiteur-puteaux", "chef-prive-boulogne-billancourt"], article: "budget-traiteur-paris" },
  "chef-prive-boulogne-billancourt": { voisins: ["traiteur-boulogne-billancourt", "chef-prive-paris-16", "chef-prive-neuilly-sur-seine", "chef-prive-paris-7"], article: "chef-prive-domicile-paris" },
  "chef-prive-neuilly-sur-seine": { voisins: ["traiteur-neuilly-sur-seine", "chef-prive-paris-16", "chef-prive-paris-8", "chef-prive-boulogne-billancourt"], article: "chef-prive-domicile-paris" },
  "chef-prive-paris-7": { voisins: ["traiteur-paris-7", "chef-prive-paris-8", "chef-prive-paris-16", "chef-prive-boulogne-billancourt"], article: "chef-prive-domicile-paris" },
  "chef-prive-paris-8": { voisins: ["traiteur-paris-8", "chef-prive-paris-7", "chef-prive-neuilly-sur-seine", "chef-prive-paris-16"], article: "chef-prive-domicile-paris" },
  "chef-prive-paris-16": { voisins: ["traiteur-paris-16", "chef-prive-boulogne-billancourt", "chef-prive-paris-7", "chef-prive-neuilly-sur-seine"], article: "chef-prive-domicile-paris" },
  "traiteur-anniversaire-paris": { voisins: ["traiteur-fiancailles-paris", "traiteur-cremaillere-paris", "traiteur-bapteme-paris", "chef-prive-paris-16"], article: "budget-traiteur-paris" },
  "traiteur-bapteme-paris": { voisins: ["traiteur-anniversaire-paris", "traiteur-fiancailles-paris", "traiteur-cremaillere-paris", "chef-prive-paris-7"], article: "chef-prive-domicile-paris" },
  "traiteur-cremaillere-paris": { voisins: ["traiteur-anniversaire-paris", "traiteur-bapteme-paris", "traiteur-fiancailles-paris", "chef-prive-paris-8"], article: "budget-traiteur-paris" },
  "traiteur-fiancailles-paris": { voisins: ["traiteur-anniversaire-paris", "traiteur-bapteme-paris", "traiteur-cremaillere-paris", "chef-prive-neuilly-sur-seine"], article: "sommelier-evenement" },
  "traiteur-cocktail-entreprise-paris": { voisins: ["traiteur-seminaire-paris", "traiteur-inauguration-paris", "traiteur-vernissage-paris", "traiteur-courbevoie-la-defense"], article: "cocktail-dinatoire-traiteur-paris" },
  "traiteur-depart-retraite-paris": { voisins: ["traiteur-cocktail-entreprise-paris", "traiteur-seminaire-paris", "traiteur-inauguration-paris", "traiteur-vernissage-paris"], article: "buffet-entreprise-paris-livraison-hebdomadaire" },
  "traiteur-inauguration-paris": { voisins: ["traiteur-vernissage-paris", "traiteur-cocktail-entreprise-paris", "traiteur-depart-retraite-paris", "traiteur-seminaire-paris"], article: "cocktail-dinatoire-traiteur-paris" },
  "traiteur-seminaire-paris": { voisins: ["traiteur-cocktail-entreprise-paris", "traiteur-depart-retraite-paris", "traiteur-inauguration-paris", "traiteur-courbevoie-la-defense"], article: "diner-entreprise-bureaux-paris" },
  "traiteur-vernissage-paris": { voisins: ["traiteur-inauguration-paris", "traiteur-cocktail-entreprise-paris", "traiteur-depart-retraite-paris", "traiteur-seminaire-paris"], article: "sommelier-evenement" },
};
