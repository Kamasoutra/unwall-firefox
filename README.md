# Unwall pour Firefox

Extension indépendante qui repère les articles payants et les ouvre automatiquement dans le lecteur de [unwall.app](https://unwall.app/). Le site de presse est remplacé dans le même onglet par le lecteur Unwall. L’extension n’est pas affiliée à Unwall et ne garantit pas la récupération de tous les articles.

## Installer dans Firefox

Firefox **142 ou plus récent**.

1. Télécharger le **XPI signé** depuis les [versions GitHub](https://github.com/Kamasoutra/unwall-firefox/releases).
2. Ouvrir `about:addons`, puis ⚙️ → **Installer un module depuis un fichier…**.
3. Sélectionner `unwall-firefox-1.0.0-signed.xpi` et accepter les permissions Firefox.
4. Ouvrir un article. La détection automatique est active par défaut. Le bouton Unwall est accessible dans le menu des extensions de Firefox ; il peut être épinglé à la barre d’outils.

La version **1.0.0 est signée par Mozilla** et s’installe durablement. Sa signature et son installation permanente ont été vérifiées dans un profil Firefox standard isolé. Cette version concerne Firefox bureau ; Android reste à vérifier.

La [procédure de signature privée Mozilla](mozilla/README.md), la politique de confidentialité et les notes de revue sont préparées dans `mozilla/`. La commande `npm run sign` est disponible si les identifiants API Mozilla sont déjà configurés dans l’environnement.

La distribution est actuellement hors catalogue Mozilla. Les nouvelles versions devront être installées manuellement. Le paquet généré localement par `npm run build` n’est pas signé ; il peut être chargé temporairement avec `about:debugging#/runtime/this-firefox`, en choisissant `extension/manifest.json` ou le XPI de développement.

## Utilisation

- Un article payant reconnu s’ouvre dans Unwall, dans le même onglet.
- Le popup permet de mettre l’ouverture automatique en pause, globalement ou pour le site actuel. Les exceptions incluent les sous-domaines et sont conservées localement.
- **Lire avec Unwall**, le raccourci **Alt + Maj + U** / **⌥ ⇧ U** sur Mac et le menu contextuel permettent une ouverture manuelle, même pendant la pause.
- Un clic droit sur un lien puis **Lire avec Unwall** ouvre le lecteur dans un nouvel onglet.
- Dans le lecteur, **Revenir à l’article original** revient à la source. Le bouton Précédent de Firefox fonctionne aussi. Le même article n’est plus redirigé automatiquement dans cet onglet jusqu’à l’ouverture d’un autre article avec l’extension ; une ouverture manuelle reste possible.
- Les réglages s’appliquent aussi aux onglets déjà ouverts où l’extension a été chargée. Après une première installation, recharger les onglets antérieurs pour y injecter la détection.

## Détection et limites

La détection s’exécute localement dans la page : métadonnées JSON-LD `Article` / `NewsArticle`, `isAccessibleForFree: false`, section `hasPart` payante, ou blocage d’abonnement visible sur une page identifiée comme un article. Les murs ajoutés après le chargement et les navigations sans rechargement sont pris en compte. Les onglets en arrière-plan sont examinés lorsqu’ils deviennent visibles.

Les pages d’accueil, les pages de connexion/abonnement et les cadres intégrés ne déclenchent pas l’ouverture. Les marqueurs masqués et les invitations simples à une newsletter sont ignorés. Un site sans métadonnées et sans marqueur reconnu peut nécessiter une ouverture manuelle. Une déclaration d’article payant peut aussi être présente pour un lecteur déjà abonné : mettre ce site en pause si nécessaire.

L’extension utilise le lecteur distant d’Unwall, sans son API interne ni code distant exécuté dans l’extension. La récupération complète dépend du site source et du service Unwall ; un blocage serveur ou un article indisponible peut subsister. Le retour à l’original reste disponible si le lecteur ne peut pas récupérer l’article.

## Données et permissions

Seule l’adresse de l’article ouvert est transmise à Unwall par navigation vers `https://unwall.app/<URL complète>`. Les paramètres usuels de suivi (`utm_*`, `fbclid`, `gclid`…) et le fragment sont supprimés ; les autres paramètres utiles sont conservés. Le contenu de la page, les cookies et les identifiants de connexion ne sont pas transmis par l’extension. Le service Unwall possède son propre fonctionnement et ses propres traitements.

Les adresses locales et IP littérales, les ports inhabituels, les URL avec identifiants et certains paramètres sensibles (`token`, `session`, `password`, `signature`…) sont refusés, y compris en ouverture manuelle. Ces filtres ne peuvent pas reconnaître toutes les URL privées : utiliser la pause ou une exception pour un site privé accessible sur un domaine public.

L’extension ne contient pas de télémétrie. Les préférences et exclusions restent dans `storage.local`. Une adresse d’origine par onglet reste dans `storage.session`, en mémoire, pour éviter les boucles de retour. Cette donnée est supprimée à la fermeture de l’onglet et n’est pas conservée entre les sessions de Firefox.

Permissions : accès aux pages HTTP/HTTPS pour la détection locale ; `tabs` pour lire et ouvrir l’adresse de l’onglet ; `storage` pour les réglages et la prévention des boucles ; `menus` pour le clic droit ; `webNavigation` pour les navigations internes des sites. Le manifeste déclare la transmission d’adresses (`browsingActivity`) pour le consentement natif de Firefox.

## Développement et vérification

Node.js 22.19+ et Firefox installé. Aucune dépendance n’est embarquée dans l’extension.

```sh
npm ci
npm test
npm run lint
npm run build
npm start
```

Le paquet produit est `dist/unwall-firefox-1.0.0.xpi`. `npm start` lance un profil de développement distinct via `web-ext`.

```sh
npm run test:firefox
```

Ce test installe temporairement le vrai paquet dans un profil Firefox isolé et vérifie articles gratuits, pause, exceptions, redirection, retour à l’original, mur différé et ouverture manuelle. Les pages de test sont servies localement via un proxy HTTP dans ce profil. Les redirections utilisent le vrai site Unwall. Le pilote Gecko est téléchargé depuis Mozilla au premier lancement. Le profil personnel n’est pas utilisé. Sur un autre système, définir `FIREFOX_BINARY` pour le test.

Pour vérifier aussi un article public réel :

```sh
LIVE_ARTICLE_URL='https://un-site-de-presse.fr/un-article' npm run test:firefox
```

Les captures et observations sont écrites dans `artifacts/`. Un test de redirection ne constitue pas à lui seul une preuve de récupération intégrale du texte.

Références : [format du manifeste Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json), [chargement temporaire](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/), [signature des extensions](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/).
