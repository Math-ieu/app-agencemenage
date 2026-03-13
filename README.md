# Agence Ménage - Back-Office Frontend

Cette application est le tableau de bord administratif permettant de gérer opérationnellement l'activité de **Agence Ménage**. Elle est construite avec **React**, **TypeScript** et **Vite**.

## 🎨 Design & UI
- **Framework CSS** : Tailwind CSS.
- **Iconographie** : Lucide React.
- **Design System** : Palette de couleurs personnalisée (#175e5c, #edba54) avec une interface moderne (Glassmorphisme, Micro-animations).
- **Responsive** : Optimisé pour PC, Tablettes et Smartphones.

## 🚀 Fonctionnalités Principales
- **Tableau de Bord Dynamique** : Vue liste et grille pour le suivi des interventions.
- **Gestion des Demandes** : Interface dédiée pour traiter les nouvelles demandes (validation, NRP, annulation).
- **Formulaire de Création Intelligent** : Création manuelle de demandes avec calcul dynamique selon le type de service.
- **Suivi Financier** : Visualisation du statut des paiements (Payé, Acompte, Non payé).
- **Synchronisation WhatsApp** : Interface de contact direct avec les clients.

## ⚙️ Installation & Démarrage

1. **Installation des modules** :
   ```bash
   npm install
   ```

2. **Lancement du serveur de développement** :
   ```bash
   npm run dev
   ```

3. **Variables d'environnement** :
   Le fichier `.env` doit contenir `VITE_API_URL` pointant vers l'URL du Backend Django.

## 📁 Architecture des Fichiers
- **`src/api/`** : Services Axios et intercepteurs pour la gestion des tokens JWT.
- **`src/components/`** : Composants UI réutilisables (Modales, Filtres, Cartes).
- **`src/pages/`** : Pages principales (Demandes, Dashboard, Login, etc.).
- **`src/store/`** : Gestion de l'état global (Auth, Notifications).
- **`src/index.css`** : Styles globaux et classes utilitaires personnalisées.

## 🛠 Commandes Utiles
- `npm run build` : Génération du bundle de production dans le dossier `dist/`.
- `npm run lint` : Vérification de la qualité du code TypeScript.