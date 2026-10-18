# Signature Mozilla pour installation permanente

Canal retenu : **On your own / Par vos propres moyens / unlisted**. L’extension est signée par Mozilla sans être ajoutée au catalogue public. Le paquet signé est `dist/signed/unwall-firefox-1.0.0-signed.xpi` ; le paquet à la racine de `dist/` reste un paquet de développement non signé.

Le 18 octobre 2026, la version **1.0.0** a été approuvée après validation automatique sans erreur ni avertissement. Le paquet signé a été téléchargé et son installation permanente vérifiée dans Firefox standard. [Version approuvée](https://addons.mozilla.org/fr/developers/addon/ff61080b8ce3458d99ad/versions/6592568). La soumission concerne Firefox bureau ; Android n’a pas encore été testé et n’est pas déclaré compatible.

L’identifiant et l’état observé sont conservés dans `submission.json`. Une modification du code devra porter un numéro de version supérieur et être signée à nouveau.

## Soumission dans le navigateur

1. Se connecter au [portail développeur Mozilla](https://addons.mozilla.org/developers/addons).
2. Choisir **Submit a New Add-on**, puis **On your own**.
3. Envoyer `dist/unwall-firefox-1.0.0.xpi`.
4. Conserver la compatibilité Firefox bureau déclarée par le manifeste. Le XPI contient directement les sources lisibles, sans minification ni compilation : aucun paquet de sources complémentaire n’est nécessaire.
5. Fournir `privacy-policy.txt` comme politique de confidentialité et `reviewer-notes.txt` comme notes de revue si ces champs sont proposés. Ne pas déclarer l’absence de transmission : les URL des articles ouverts sont envoyées au lecteur tiers.
6. Après acceptation, télécharger le XPI **signé** depuis la page de la version. Le ranger dans `dist/signed/` pour le distinguer du paquet de développement.
7. Dans Firefox, ouvrir `about:addons`, puis le menu engrenage et **Installer un module depuis un fichier…**. Choisir le XPI signé et valider l’installation.

L’extension doit alors rester présente après redémarrage de Firefox. Vérifier son nom et sa version dans `about:addons`, puis relancer Firefox quand le travail en cours permet de fermer le navigateur et revérifier sa présence.

La signature permet une installation persistante ; elle ne constitue pas une garantie de récupération des articles par Unwall. Elle ne configure pas de mises à jour automatiques : une prochaine version privée pourra être signée puis installée par-dessus, avec le même identifiant et un numéro de version supérieur.

## Variante en ligne de commande

Si les identifiants API Mozilla existent déjà dans l’environnement sous `WEB_EXT_API_KEY` et `WEB_EXT_API_SECRET` :

```sh
npm run sign
```

Cette commande envoie les sources de `extension/` à l’API officielle Mozilla, demande une signature privée et télécharge le résultat dans `dist/signed/`. Elle requiert un compte développeur configuré et ses conditions acceptées. Ne pas écrire les clés dans le dépôt ni les communiquer dans la conversation. Les notes de revue sont dans `amo-metadata.json` ; une politique de confidentialité pourra être ajoutée dans le portail si nécessaire.

Références : [soumission privée](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/#self-distribution), [commande officielle web-ext sign](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign).
