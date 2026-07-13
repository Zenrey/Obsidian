# Ostia Monsters

Jeu web 3D low poly de type Pokémon (fan game non-officiel, créatures 100 % originales),
situé dans la région d'**Ostia** — villes inspirées de l'Australie : **Sydnera**, **Melbora**, **Canberry**.

## Jouer

Le jeu est un site statique : servir ce dossier et ouvrir `index.html`.

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

Débogage : ajouter `?dev=1` à l'URL (FPS, draw calls, hooks de test `window.__ostia`).

## Contenu

- Menu titre animé (diorama 3D tournant, boutons Jouer / Continuer / Options).
- Options : volumes musique/effets, langue FR/EN, qualité graphique, secousses d'écran.
- Monde ouvert low poly : 3 villes, 2 routes avec hautes herbes, centres de soins, sauvegarde locale.
- 6 créatures originales inspirées de la faune australienne (Kangarouge, Dingoflam, Koalys,
  Eucalypin, Ornithos, Crocobleu) sur un triangle de types Feu > Plante > Eau > Feu.
- Combats tour par tour : attaques, capture à l'Orbe, potions, fuite, montée de niveau,
  duel final contre le Ranger Jack à Canberry.
- Clavier (codes physiques, compatible AZERTY), tactile (joystick virtuel) et manette.

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | page + interface (menu, HUD, dialogues, combat) |
| `main.js` | boucle de jeu, états, entrées, sauvegarde |
| `world.js` | génération du monde d'Ostia |
| `models.js` | modèles 3D low poly procéduraux |
| `battle.js` | système de combat |
| `data.js` | équilibrage (stats, attaques, tables de rencontre) |
| `strings.js` | tous les textes FR/EN |
| `audio.js` | musiques et effets (générés via Higgsfield) |
| `logic.js` | module règles requis par la plateforme de déploiement |
| `design/assets.csv` | manifeste des assets |

Rendu : Three.js 0.160 + GLTFLoader (vendorisés dans `assets/vendor/`).
Créatures et héros : modèles 3D générés avec Higgsfield (`sam_3_3d`, images de concept
nano banana), chargés depuis le CDN Higgsfield avec repli automatique sur des modèles
procéduraux si le chargement échoue. Musiques, effets sonores et images de couverture
générés avec Higgsfield.

## Déploiement

- URL de jeu : https://humble-parade-590.higgsfield.gg/
- `game_id` Higgsfield (à repasser à `deploy_game` pour mettre à jour sans changer d'URL) :
  `7e561a83-3b5a-4e1f-8175-88bec46470a4`
- Zip de déploiement : `dist/ostia-monsters.zip` (layout plateforme : `logic.js` + `index.html` à la racine)
