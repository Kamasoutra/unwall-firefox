# Vérification du 18 octobre 2026

Environnement : macOS, Firefox 157.0.1, profil de test isolé, installation temporaire du paquet `dist/unwall-firefox-1.0.0.xpi`. Le profil Firefox personnel n’a pas été modifié.

## Résultats de l’extension

- `npm test` : 9 tests réussis (métadonnées, murs visibles/masqués, newsletters, pages non éditoriales, URL sensibles, nettoyage des liens et compatibilité des paramètres d’URL dans les scripts Firefox).
- `npm run lint` : 0 erreur, 0 avertissement, 0 notice.
- `npm run build` : XPI produit ; aucune dépendance de développement embarquée.
- `npm run test:firefox` : les 9 scénarios passent dans Firefox : article gratuit préservé, pause globale, exception par site, réactivation et redirection, retour à l’original, mur ajouté après chargement, ouverture manuelle pendant la pause, bouton Précédent sans boucle, rendu du popup.
- Le rendu du popup a été inspecté sur la capture `artifacts/popup.png`.

La vérification Firefox a révélé un problème réel absent des tests DOM : les itérateurs `URLSearchParams.keys()` ne sont pas utilisables depuis le compartiment du script de contenu. L’extension utilise désormais `forEach` pour les paramètres ; un test de régression couvre ce cas.

## Résultats réels du service Unwall

La détection automatique et la redirection ont été vérifiées sur deux articles réels :

- **Le Figaro**, article d’horlogerie du 16 octobre 2026 : article reconnu, lecteur Unwall ouvert ; le contenu distant affiche un refus d’accès de l’éditeur. Texte intégral indisponible dans ce test.
- **Mediapart**, article sur l’IA et la communauté mathématicienne du 17 octobre 2026 : article reconnu, lecteur ouvert ; Unwall affiche le titre, l’introduction publique et un message explicite de limitation concernant le paywall serveur. Texte intégral indisponible dans ce test.

Ces vérifications prouvent le fonctionnement de la détection et de l’ouverture automatique. **Elles ne prouvent pas un déblocage intégral sur ces éditeurs.** Le service Unwall peut ne pas récupérer les passages qui restent sur le serveur de l’éditeur. L’extension ne déclare pas un article « débloqué » sur la seule base d’une redirection.

## Installation

Le paquet signé `dist/signed/unwall-firefox-1.0.0-signed.xpi` a été récupéré depuis le portail officiel Mozilla. Les sources correspondent au paquet soumis ; seul le formatage du manifeste change. Les signatures Mozilla sont présentes dans `META-INF/`.

Le portail confirme **Approuvé** pour la version 6592568, fichier 5136696. Une installation permanente dans Firefox 157.0.1, sans désactiver la vérification des signatures, confirme `isActive: true`, `signedState: 2`, `temporarilyInstalled: false`. SHA-256 : `8ead311d1575ccf40d0fc8511908e1b204ff1d15be45996d80c4c9b1f7ed6119`. Seul Firefox bureau est déclaré compatible ; Android n’a pas encore été testé. Le suivi est conservé dans `mozilla/submission.json`.

Un test local de sélection de fichier dans Chrome a pu ouvrir le sélecteur macOS et lire `unwall-firefox-1.0.0.xpi` (10 904 octets). L’archive est intacte et le manifeste est à sa racine. L’upload Mozilla a ensuite réussi ; aucune cause précise du blocage initial de sélection n’a été établie.

## Version 1.1.0 et Android

La version 1.1.0 ajoute le dépôt GitHub comme page d’accueil et comme lien dans l’interface. Elle déclare Android, ignore les API de menus/raccourcis absentes sur cette plateforme, et adapte les commandes tactiles. Elle n’a pas encore été envoyée à Mozilla ni signée.

- Firefox 157.0.1 sur macOS : les neuf scénarios de navigation et de rendu passent avec le paquet 1.1.0.
- Firefox 158.0 officiel, Android 16 / API 36 arm64, émulateur isolé : les huit scénarios de navigation passent, ainsi que le rendu de la page du popup et les contrôles de largeur, du mode mobile et du masquage du raccourci clavier.
- `npm test` : neuf tests réussis. `npm run lint` : zéro erreur, avertissement ou notice. `git diff --check` : aucun défaut.
- La capture `artifacts/popup-android.png` provient du moteur Firefox Android. L’affichage dans le menu natif des extensions et l’installation permanente mobile restent à vérifier avec un paquet signé ; aucun téléphone physique n’a été testé.
- Firefox Android signale que les entrées `menus` et `commands` sont ignorées dans le manifeste commun. Les appels JavaScript correspondants sont protégés. Les fonctions communes ont été vérifiées dans le moteur mobile.

Le premier émulateur, limité à un cœur et 2 Go de mémoire, provoquait des blocages système. Le test aboutit avec quatre cœurs et 4 Go, puis arrêt de l’émulateur de test. L’AVD existant a été utilisé en lecture seule, sans conserver ces modifications.

Le dépôt est public : https://github.com/Kamasoutra/unwall-firefox. Le XPI signé 1.0.0 publié dans sa release a été retéléchargé et son SHA-256 vérifié identique au fichier officiel Mozilla.
