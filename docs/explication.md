# Transcendence

## Guide global du projet et préparation à la soutenance

État du code étudié : 12 juin 2026

Ce document explique l’architecture, les choix techniques, les principales fonctionnalités et les mécanismes de sécurité du projet. Il contient aussi des réponses courtes aux questions classiques de soutenance.

> **Important :** ce guide décrit le code réellement présent dans le dépôt. La section « État des modules choisis » distingue ce qui est défendable, partiel ou absent.

<!-- pagebreak -->

## Sommaire

1. Vue d’ensemble
2. Architecture générale
3. Langages et frameworks
4. Architecture Docker et HTTPS
5. Backend NestJS
6. Prisma et PostgreSQL
7. Authentification et sécurité
8. OAuth 2.0 avec 42
9. WebSockets et temps réel
10. Frontend React et Next.js
11. Fonctionnalités métier
12. RGPD
13. Tests et fichiers `.spec.ts`
14. État des modules choisis
15. Questions fréquentes de soutenance
16. Démonstration conseillée
17. Limites et améliorations

## 1. Vue d’ensemble

Transcendence est une plateforme sociale de discussion en temps réel. Un utilisateur peut créer un compte local ou se connecter avec 42, gérer son profil, chercher d’autres utilisateurs, créer des relations, bloquer ou débloquer un compte, discuter en privé ou dans un groupe, recevoir des notifications, signaler du contenu et consulter un système de points et de badges.

Le projet contient également :

- une modération manuelle avec rôles `USER`, `MODERATOR` et `ADMIN` ;
- une modération automatique par dictionnaire et, si configurée, par l’API de modération OpenAI ;
- des protections contre l’accès à un groupe après départ ou expulsion ;
- un système de présence, de frappe en cours, de lecture et de réactions ;
- une exportation des données personnelles ;
- une suppression RGPD avec confirmation par email, session et mot de passe ;
- un déploiement Docker en mode d’exécution production.

### Parcours principal

```text
Navigateur
   |
   | HTTPS :443
   v
Nginx
   |--------------------> Frontend Next.js :3000
   |
   | /api, /uploads,
   | /socket.io
   v
Backend NestJS :3001
   |--------------------> PostgreSQL :5432
   |
   | SMTP :1025
   v
Mailpit
```

Le navigateur ne contacte pas directement le backend ou PostgreSQL. Nginx constitue le point d’entrée unique de l’application.

## 2. Architecture générale

Le dépôt est séparé en deux applications :

- `apps/frontend` : interface Next.js et React ;
- `apps/backend` : API NestJS, Socket.IO, Prisma et logique métier.

Les services sont reliés par le réseau Docker `transcendence_network`.

### Flux HTTP classique

```text
Composant React
  -> fonction API frontend
  -> fetch HTTPS avec Authorization: Bearer <access token>
  -> Nginx
  -> Controller NestJS
  -> Guard et validation DTO
  -> Service métier
  -> Prisma
  -> PostgreSQL
  -> réponse JSON
```

### Flux temps réel

```text
React
  -> connexion Socket.IO avec l’access token
  -> Gateway NestJS
  -> vérification du JWT et de l’utilisateur
  -> entrée dans une room utilisateur ou conversation
  -> émission d’un événement
  -> mise à jour immédiate des clients concernés
```

### Pourquoi cette séparation ?

La séparation frontend/backend apporte :

- des responsabilités claires ;
- une API réutilisable ;
- une sécurité centralisée côté serveur ;
- la possibilité de tester la logique métier sans navigateur ;
- un déploiement et une montée en charge indépendants.

## 3. Langages et frameworks

### TypeScript

Le frontend et le backend utilisent TypeScript. TypeScript est une extension typée de JavaScript.

Ses avantages dans ce projet :

- détection de nombreuses erreurs avant l’exécution ;
- contrats explicites pour les DTO, utilisateurs, messages et événements ;
- autocomplétion et navigation dans l’IDE ;
- refactorings plus sûrs ;
- partage d’un même langage entre frontend et backend.

TypeScript est compilé en JavaScript, car Node.js et le navigateur exécutent du JavaScript.

### Next.js et React

React sert à construire l’interface sous forme de composants. Next.js fournit le framework autour de React :

- routage par fichiers avec l’App Router ;
- rendu serveur ou client selon le composant ;
- compilation et optimisation de production ;
- pages statiques et pages dynamiques ;
- image standalone dans Docker.

Le choix est cohérent pour une interface riche contenant chat, modales, menus, formulaires, profils et tableaux d’administration.

### NestJS

NestJS est le framework backend. Il repose sur Node.js et suit une architecture modulaire fortement inspirée des frameworks d’entreprise.

Il fournit :

- contrôleurs HTTP ;
- injection de dépendances ;
- modules ;
- guards d’authentification et d’autorisation ;
- validation des entrées ;
- gateways WebSocket ;
- intégration Swagger ;
- structure adaptée aux tests unitaires.

### PostgreSQL

PostgreSQL est une base relationnelle adaptée aux données du projet :

- utilisateurs et profils ;
- relations plusieurs-à-plusieurs ;
- conversations et participants ;
- messages, lectures et réactions ;
- notifications et signalements ;
- contraintes d’unicité et transactions.

Le modèle relationnel garantit mieux la cohérence de ces liens qu’un stockage non structuré.

### Prisma

Prisma est l’ORM du projet. Il fait le lien entre TypeScript et PostgreSQL.

Il apporte :

- un schéma de données central ;
- un client TypeScript généré ;
- des requêtes typées ;
- des migrations versionnées ;
- des transactions ;
- une réduction du SQL manuel et du risque d’injection.

### Socket.IO

Socket.IO fournit le temps réel. Il ajoute au transport WebSocket :

- événements nommés ;
- reconnexion ;
- accusés de réception ;
- rooms ;
- gestion pratique des connexions.

### Docker et Nginx

Docker rend l’environnement reproductible. Nginx termine TLS et distribue les requêtes vers Next.js ou NestJS.

## 4. Architecture Docker et HTTPS

### Services

| Service | Rôle | Exposition |
|---|---|---|
| `nginx` | Reverse proxy et terminaison HTTPS | Port hôte `443` |
| `frontend` | Serveur Next.js standalone | Réseau Docker uniquement |
| `backend` | API NestJS et Socket.IO | Réseau Docker uniquement |
| `postgres` | Base PostgreSQL | Réseau Docker uniquement |
| `pgadmin` | Interface d’administration PostgreSQL | `127.0.0.1:5050` |
| `mailpit` | Serveur SMTP de développement | `127.0.0.1:8025` en HTTPS |

### Image et conteneur

Une **image Docker** est un modèle immuable contenant l’application et ses dépendances. Un **conteneur** est une instance en cours d’exécution de cette image.

Les Dockerfiles frontend et backend sont multi-étapes :

1. installation des dépendances ;
2. compilation ;
3. copie des seuls artefacts nécessaires dans l’image finale.

Les processus frontend et backend s’exécutent avec des utilisateurs non-root.

### Volumes

Les données persistantes utilisent des volumes Docker nommés :

- `postgres_data` : fichiers de la base ;
- `uploads_data` : avatars ;
- `pgadmin_data` : configuration persistante de pgAdmin.

Un volume survit au redémarrage ou à la recréation d’un conteneur.

### Commandes Makefile

- `make` ou `make up` : certificat, build et démarrage ;
- `make down` : arrêt des conteneurs, données conservées ;
- `make re` : redémarrage complet ;
- `make build` : reconstruction des images ;
- `make logs` : journaux ;
- `make ps` : état des services ;
- `make clean` : conteneurs et images locales supprimés, volumes conservés ;
- `make fclean` : conteneurs, images, volumes, base, uploads et certificats supprimés.

> **Attention :** `make fclean` détruit réellement toutes les données PostgreSQL.

### Rôle de Nginx

Nginx reçoit les connexions HTTPS et applique le routage :

- `/` vers Next.js ;
- `/api/` vers NestJS ;
- `/uploads/` vers les fichiers servis par NestJS ;
- `/socket.io/` vers Socket.IO avec les en-têtes `Upgrade`.

Le certificat local est auto-signé. C’est adapté à une démonstration locale, pas à une production publique. En production publique, il faudrait un domaine et un certificat reconnu, par exemple via Let’s Encrypt.

### Healthchecks

Les healthchecks indiquent à Docker si un service fonctionne réellement :

- PostgreSQL utilise `pg_isready` ;
- backend et frontend répondent à une requête locale ;
- Mailpit utilise son endpoint de disponibilité HTTPS ;
- Nginx valide sa configuration.

`depends_on` attend les services critiques avant de démarrer les dépendants.

## 5. Backend NestJS

### Module

Un module regroupe une fonctionnalité. Il déclare :

- ses `imports` ;
- ses `controllers` ;
- ses `providers` ;
- éventuellement ses `exports`.

Exemples :

- `AuthModule` : authentification, JWT et rôles ;
- `UsersModule` : profils, avatars et RGPD ;
- `ChatModule` : conversations, messages et gateway ;
- `ModerationModule` : rapports et sanctions ;
- `NotificationsModule` : stockage et lecture des notifications.

Le module racine `AppModule` assemble l’application.

### Controller

Un controller représente la couche d’entrée HTTP. Il :

- définit les routes ;
- lit les paramètres, le corps et l’utilisateur authentifié ;
- applique les guards ;
- appelle le service ;
- retourne la réponse.

Il ne devrait pas contenir toute la logique métier.

Exemple conceptuel :

```text
POST /api/chat/group
  -> ChatController
  -> ChatService.createGroupConversation(...)
  -> Prisma crée la conversation et ses participants
  -> ChatGateway notifie les utilisateurs
```

### Service

Un service contient la logique métier :

- vérifications ;
- règles d’autorisation ;
- opérations Prisma ;
- transactions ;
- notifications ;
- calculs.

Le service est injectable dans un controller ou un autre service grâce à l’injection de dépendances NestJS.

### Injection de dépendances

Au lieu de créer manuellement chaque objet avec `new`, NestJS construit les instances et injecte leurs dépendances.

Exemple :

```text
ChatController dépend de ChatService.
ChatService dépend de PrismaService et AutoModerationService.
NestJS construit et relie ces objets.
```

Cela facilite le remplacement des dépendances par des mocks pendant les tests.

### DTO

DTO signifie **Data Transfer Object**. Un DTO décrit les données acceptées par une route.

Le `ValidationPipe` global :

- transforme les données ;
- supprime ou refuse les propriétés inconnues ;
- applique les validateurs ;
- évite qu’un client envoie arbitrairement des champs sensibles.

### Guard

Un guard décide si une requête est autorisée.

- `JwtAuthGuard` vérifie l’authentification JWT ;
- `RolesGuard` compare le rôle courant aux rôles demandés par `@Roles`.

Différence importante :

- authentification : « qui es-tu ? » ;
- autorisation : « as-tu le droit de faire cette action ? ».

### Strategy

`JwtStrategy` extrait le bearer token, vérifie sa signature et son expiration, puis recharge l’utilisateur dans PostgreSQL.

Ce rechargement est important : si un modérateur est rétrogradé, banni ou désactivé, les requêtes HTTP suivantes utilisent immédiatement l’état actuel de la base, même si son JWT contient un ancien rôle.

### Gateway

Une gateway est l’équivalent temps réel d’un controller. Elle reçoit et émet des événements Socket.IO.

### Interceptor

`LoggingInterceptor` journalise :

- le nom de la classe et de la méthode ;
- la méthode et le chemin HTTP, sans query string ;
- l’identifiant de socket et le nom de l’événement ;
- la durée et les erreurs.

Il ne journalise pas les corps de requêtes, mots de passe, tokens ou réponses complètes.

### Swagger

Swagger est disponible sous `/api/docs`. Il documente et permet de tester les routes HTTP. Pour les routes protégées, un bearer token doit être fourni.

## 6. Prisma et PostgreSQL

### Fonctionnement de Prisma

Le fichier `schema.prisma` contient :

- le générateur du client ;
- le fournisseur PostgreSQL ;
- les enums ;
- les modèles ;
- les relations ;
- les contraintes et index.

`npx prisma generate` produit un client TypeScript correspondant au schéma.

`npx prisma migrate deploy` applique en production les migrations déjà versionnées.

### Migration

Une migration est une modification versionnée de la structure SQL :

- création d’une table ;
- ajout d’une colonne ;
- ajout d’un index ;
- modification d’une relation.

Le projet possède 12 migrations. Elles permettent de reproduire la même base sur une autre machine.

### Modèles principaux

Le schéma contient 15 modèles.

| Modèle | Rôle |
|---|---|
| `User` | Compte, rôle, état, points et relations principales |
| `Profile` | Nom affiché, bio et avatar |
| `OAuthAccount` | Liaison avec un fournisseur OAuth |
| `RefreshToken` | Empreinte, expiration et révocation des sessions longues |
| `DataErasureRequest` | Confirmation temporaire de suppression RGPD |
| `Friendship` | Demandes et relations d’amitié |
| `Block` | Blocage orienté entre deux comptes |
| `Conversation` | Conversation directe ou groupe |
| `ConversationParticipant` | Appartenance, rôle, entrée et sortie d’un groupe |
| `Message` | Contenu, auteur, édition et suppression logique |
| `MessageRead` | Accusé de lecture |
| `MessageReaction` | Réaction d’un utilisateur à un message |
| `Notification` | Événement persistant destiné à un utilisateur |
| `Report` | Signalement d’un utilisateur ou message |
| `ModerationAction` | Historique d’une décision de modération |

### Relations importantes

```text
User 1----0..1 Profile
User 1----N OAuthAccount
User 1----N RefreshToken
User 1----0..1 DataErasureRequest

User N----N User via Friendship
User N----N User via Block

User N----N Conversation via ConversationParticipant
Conversation 1----N Message
Message N----N User via MessageRead
Message N----N User via MessageReaction

User 1----N Notification
User 1----N Report
Report 1----N ModerationAction
```

### Clés et identifiants

Les identifiants utilisent `cuid()`. Ils sont difficiles à deviner, uniques et pratiques dans une architecture distribuée.

### Contraintes

Exemples :

- `email` et `username` sont uniques ;
- un compte OAuth est unique par fournisseur et identifiant fournisseur ;
- une relation de blocage est unique pour un couple orienté ;
- un participant est unique par conversation et utilisateur ;
- une lecture est unique par message et utilisateur.

Les contraintes protègent la cohérence même en cas de requêtes concurrentes.

### Index

Un index accélère certaines recherches au prix d’espace disque et d’un coût supplémentaire lors des écritures.

Exemples :

- messages par conversation et date ;
- notifications par utilisateur et état lu ;
- rapports par statut et date ;
- refresh tokens par utilisateur.

### `onDelete: Cascade`, `SetNull`

- `Cascade` supprime les enfants lorsqu’un parent disparaît ;
- `SetNull` conserve l’enregistrement mais retire la référence.

Exemple : supprimer un utilisateur supprime son profil et ses refresh tokens. Un rapport peut conserver une trace tout en mettant certains auteurs ou messages à `null`, selon la relation.

### Transactions

Une transaction garantit le principe « tout ou rien ».

Elles sont utilisées notamment pour :

- bannir un utilisateur et révoquer ses refresh tokens ;
- traiter un rapport une seule fois ;
- supprimer les données RGPD ;
- modifier plusieurs objets cohérents ensemble.

Si une étape échoue, Prisma annule l’ensemble.

## 7. Authentification et sécurité

### Inscription locale

1. normalisation de l’email ;
2. vérification de l’unicité email et username ;
3. génération d’un sel bcrypt avec un coût de 12 ;
4. hash du mot de passe ;
5. création de l’utilisateur et du profil ;
6. création de la session.

Le mot de passe brut n’est jamais stocké.

### Hash et sel bcrypt

Un hash est une transformation à sens unique. On ne déchiffre pas un hash.

Le sel est une valeur aléatoire différente pour chaque hash. Il empêche deux utilisateurs ayant le même mot de passe d’avoir la même valeur en base et rend les tables précalculées inefficaces.

Dans bcrypt, le sel et le facteur de coût sont intégrés dans la chaîne stockée. Une colonne `passwordSalt` séparée n’est donc pas nécessaire.

### Access token

L’access token est un JWT de courte durée. Il est envoyé dans :

```text
Authorization: Bearer <token>
```

Dans ce projet, il est stocké uniquement dans la mémoire du store Zustand. Il n’est pas persisté dans `localStorage`.

Conséquences :

- il disparaît lors d’un rechargement complet ;
- `AuthBootstrap` appelle `/auth/refresh` pour en obtenir un nouveau ;
- il est moins exposé à une lecture persistante par un script injecté qu’un token en `localStorage`.

### JWT

JWT signifie **JSON Web Token**. Il contient trois parties :

```text
header.payload.signature
```

Le payload contient notamment :

- `sub` : identifiant de l’utilisateur ;
- email ;
- username ;
- rôle ;
- dates d’émission et d’expiration.

Un JWT est signé mais pas chiffré. Son contenu peut être décodé par le client. Il ne faut donc jamais y placer un mot de passe ou un secret.

La signature permet au serveur de détecter toute modification.

### Refresh token

Le refresh token du projet n’est pas un JWT. C’est une valeur opaque et aléatoire générée avec 48 octets cryptographiques.

Il sert à obtenir un nouvel access token sans redemander le mot de passe.

Stockage :

- navigateur : cookie `HttpOnly`, `Secure`, `SameSite=Lax` ;
- base : uniquement une empreinte SHA-256 ;
- jamais dans le JavaScript frontend.

À chaque refresh, la session peut être contrôlée, le rôle actuel est relu et le token est renouvelé.

### Cookie

Un cookie est une donnée gérée par le navigateur et associée à un domaine.

Attributs utilisés :

- `HttpOnly` : JavaScript ne peut pas lire le refresh token ;
- `Secure` : envoi uniquement en HTTPS ;
- `SameSite=Lax` : réduction du risque CSRF ;
- `Path=/` : disponible sur le site ;
- `Max-Age` : durée de vie.

Le navigateur stocke le cookie dans son espace interne, pas dans PostgreSQL. PostgreSQL ne stocke que le hash du refresh token.

### Connexion, refresh et déconnexion

```text
Login
  -> mot de passe vérifié par bcrypt
  -> access token retourné en JSON
  -> refresh token placé en cookie HttpOnly

Refresh
  -> cookie envoyé automatiquement
  -> hash recherché en base
  -> vérification expiration, révocation, ban et activité
  -> nouvel access token

Logout
  -> refresh token révoqué
  -> cookie supprimé
  -> store Zustand vidé
  -> socket déconnectée
```

### Rotation et révocation

Les refresh tokens possèdent `expiresAt` et `revokedAt`.

Ils sont révoqués au logout et lors d’un bannissement. Cela coupe les sessions longues.

### Rôles

La hiérarchie est :

```text
ADMIN > MODERATOR > USER
```

Un modérateur ne peut pas bannir ou modifier les points d’un autre modérateur ou d’un administrateur. Seul un administrateur peut promouvoir ou rétrograder.

### Codes HTTP utiles

- `200` : succès ;
- `201` : ressource ou opération créée ;
- `400` : entrée invalide ;
- `401` : non authentifié ou token invalide ;
- `403` : authentifié mais non autorisé ;
- `404` : ressource absente ;
- `409` : conflit possible ;
- `500` : erreur serveur.

## 8. OAuth 2.0 avec 42

### Principe

OAuth permet de déléguer l’authentification à 42.

Flux simplifié :

1. le navigateur est redirigé vers 42 ;
2. l’utilisateur autorise l’application ;
3. 42 redirige vers le callback avec un code temporaire ;
4. le backend échange ce code contre un access token 42 ;
5. le backend récupère le profil 42 ;
6. il trouve ou crée l’utilisateur local ;
7. il crée ensuite sa propre session Transcendence.

Le token 42 n’est pas l’access token JWT de l’application. Ce sont deux systèmes distincts.

### Pourquoi le backend échange le code ?

Le secret client OAuth ne doit jamais être exposé dans le navigateur. L’échange du code doit donc être effectué côté backend.

### Protection `state`

Le paramètre `state` lie une demande OAuth à la session qui l’a initiée. Il protège principalement contre le login CSRF et les substitutions de flux.

Fonctionnement recommandé :

1. générer une valeur aléatoire ;
2. la stocker dans un cookie sécurisé ou une session ;
3. l’envoyer dans l’URL d’autorisation ;
4. vérifier exactement la même valeur au callback ;
5. la consommer une seule fois.

> **Limite actuelle :** le flux 42 présent dans le code envoie `client_id`, `redirect_uri` et `response_type=code`, mais pas de `state`. Il faut le présenter comme une amélioration de sécurité encore nécessaire, et non prétendre qu’il est déjà protégé.

PKCE serait également une amélioration possible.

## 9. WebSockets et temps réel

### HTTP contre WebSocket

HTTP fonctionne généralement en requête/réponse : le client demande, le serveur répond.

WebSocket garde une connexion bidirectionnelle ouverte. Le serveur peut pousser une information sans attendre une nouvelle requête.

### Connexion Socket.IO

Le frontend ouvre la namespace `/chat` et fournit l’access token dans le handshake :

```text
auth: { token: accessToken }
```

Le backend :

1. vérifie le JWT ;
2. recharge l’utilisateur ;
3. refuse les comptes inexistants, inactifs ou bannis ;
4. place les informations authentifiées dans `socket.data.user`.

### Rooms

Une room est un groupe logique de sockets.

Le projet utilise :

- `user:<userId>` : toutes les connexions d’un utilisateur ;
- `conversation:<conversationId>` : sockets ayant rejoint une conversation.

La room utilisateur permet d’envoyer une notification à toutes les fenêtres ou appareils du même compte.

### Contrôle d’accès aux conversations

Pour rejoindre une room conversation, la gateway vérifie une participation avec :

```text
conversationId
userId
leftAt = null
```

Un utilisateur expulsé ou ayant quitté le groupe ne peut donc plus rejoindre la room.

Le service applique aussi cette vérification pour lire, envoyer, modifier, supprimer, réagir ou marquer comme lu.

### Événements importants

| Événement | Utilité |
|---|---|
| `chat.joinConversation` | Rejoindre une room autorisée |
| `chat.leaveConversation` | Quitter la room socket |
| `chat.sendMessage` | Envoyer un message |
| `chat.editMessage` | Modifier un message |
| `chat.deleteMessage` | Suppression logique |
| `chat.markRead` | Accusé de lecture |
| `chat.typing.start/stop` | Indicateur de frappe |
| `presence.list` | Synchroniser les utilisateurs en ligne |
| `presence.changed` | Connexion ou déconnexion |
| `chat.conversation.created` | Afficher un nouveau channel sans refresh |
| `chat.conversation.accessRevoked` | Retirer immédiatement un membre expulsé |
| `notification.created` | Notification temps réel |
| `chat.moderation.warning/banned` | Sanction immédiate |

### Présence

Le backend maintient une `Map<userId, Set<socketId>>`.

Le `Set` est important : un utilisateur peut avoir plusieurs onglets. Il n’est déclaré hors ligne que lorsque sa dernière socket se déconnecte.

La présence d’une conversation est calculée à partir des membres autorisés et des utilisateurs réellement connectés, pas du nombre total de connexions du serveur.

### Reconnexion

Socket.IO tente plusieurs reconnexions. Si le token est expiré, le frontend appelle le refresh HTTP, met à jour `socket.auth`, puis reconnecte.

### Limite de montée en charge

La présence et les rooms sont actuellement en mémoire dans une seule instance backend. Avec plusieurs réplicas NestJS, il faudrait un adaptateur distribué, souvent Redis, afin que les événements et rooms soient partagés.

## 10. Frontend React et Next.js

### Composant React

Un composant est une fonction qui retourne une description d’interface JSX.

Exemples :

- `Header` ;
- `ChatPage` ;
- `NotificationsMenu` ;
- `PublicProfilePage` ;
- `AdminDashboard`.

Les composants peuvent recevoir des propriétés, appelées props.

### État

L’état représente une donnée qui peut changer et provoquer un nouveau rendu.

Exemple :

```text
messageInput
selectedConversation
notifications
loading
modal ouverte ou fermée
```

### Hooks

- `useState` : état local ;
- `useEffect` : effet après rendu, chargement API ou écoute socket ;
- `useMemo` : valeur calculée mémorisée ;
- `useCallback` : fonction mémorisée ;
- `useRef` : valeur mutable qui ne déclenche pas de rendu ;
- hooks personnalisés : logique réutilisable, comme `useOnlinePresence`.

Les hooks doivent être appelés au niveau supérieur d’un composant ou d’un hook, pas dans une condition arbitraire.

### Zustand

Zustand fournit un état global léger.

Stores principaux :

- authentification : utilisateur et access token ;
- notifications : liste, lecture et conversation active.

L’access token reste en mémoire. Après un refresh de page, `AuthBootstrap` restaure la session grâce au cookie HttpOnly.

### App Router

Les fichiers sous `src/app` définissent les routes :

- `/` : chat ;
- `/profiles` et `/profiles/[username]` ;
- `/search` ;
- `/admin` ;
- `/moderation` ;
- `/rgpd` ;
- `/rgpd/confirm-deletion` ;
- `/terms`.

### Server et Client Components

Dans Next.js, un composant est serveur par défaut. La directive :

```text
"use client";
```

est nécessaire lorsqu’il utilise l’état, les effets, les événements navigateur, Zustand ou Socket.IO.

### Couche API

Les fonctions API évitent de mettre tous les `fetch` directement dans les composants.

`fetchWithAuth` :

1. ajoute le bearer token ;
2. envoie les cookies avec `credentials: include` ;
3. si le serveur répond `401`, tente un refresh unique partagé ;
4. rejoue la requête avec le nouveau token ;
5. vide l’état et la socket si le refresh échoue.

Le refresh unique évite que dix requêtes simultanées lancent dix rotations concurrentes.

### Organisation par fonctionnalité

Le frontend est organisé par `features` :

- `auth` ;
- `chat` ;
- `friends` ;
- `notifications` ;
- `profiles` ;
- `search` ;
- `admin` ;
- `moderation` ;
- `gamification` ;
- `rgpd`.

Cette organisation regroupe composants, API, types, hooks et stores par domaine fonctionnel.

## 11. Fonctionnalités métier

### Gestion des utilisateurs

- inscription et connexion locale ;
- OAuth 42 ;
- profil public et personnel ;
- modification du profil et du mot de passe ;
- avatar persistant dans un volume Docker ;
- rôles et état actif/banni.

### Relations

- demande d’ami ;
- acceptation ;
- suppression ;
- blocage et déblocage ;
- notifications associées.

Les utilisateurs bloqués restent visibles dans la recherche avec deux indicateurs :

- « vous avez bloqué cet utilisateur » ;
- « cet utilisateur vous a bloqué ».

Cela permet au bloqueur de retrouver la personne pour la débloquer.

### Recherche

Le backend :

- exige au moins deux caractères ;
- cherche sans sensibilité à la casse dans username et displayName ;
- trie par username ;
- limite à 20 résultats ;
- renvoie les deux directions de blocage.

Le frontend filtre les usernames commençant par la recherche et pagine par groupes de cinq.

### Chat avancé

- conversation directe unique grâce à `participantHash` ;
- groupes avec titre ;
- invitation, expulsion et départ ;
- rôles `OWNER`, `ADMIN`, `MEMBER` ;
- renommage ;
- messages temps réel ;
- édition et suppression logique ;
- réactions ;
- lectures ;
- frappe en cours ;
- présence ;
- notifications ;
- création de channel visible immédiatement.

### Notifications

Une notification possède :

- type ;
- titre et corps ;
- acteur ;
- type et identifiant d’entité ;
- action ;
- metadata JSON ;
- état lu ;
- date.

Elles sont persistées dans PostgreSQL puis poussées en temps réel.

Lorsqu’une conversation est active, ses notifications peuvent être marquées automatiquement comme lues.

Les notifications d’une conversation quittée sont filtrées afin de ne pas révéler son historique.

### Permissions

Les contrôles existent à deux niveaux :

- routes : `JwtAuthGuard`, `RolesGuard`, `@Roles` ;
- services : relecture du rôle et contrôle de hiérarchie.

Les contrôles de service sont indispensables : une route protégée ne suffit pas si la méthode est appelée depuis un autre chemin.

### Modération manuelle

- création de signalements utilisateur ou message ;
- file de rapports ;
- avertissement ;
- ban et unban ;
- rejet ;
- modification des points ;
- historique `ModerationAction` ;
- traitement transactionnel empêchant deux décisions sur le même rapport.

### Modération automatique

Le contenu est normalisé pour détecter certaines variantes :

- minuscules ;
- suppression des accents ;
- remplacement de caractères comme `0` par `o`.

Deux fournisseurs peuvent contribuer :

- dictionnaire local ;
- API OpenAI si la clé est configurée.

Une sévérité produit une action :

- faible : autoriser ;
- moyenne : publier et signaler ;
- forte : bloquer.

Des points peuvent être retirés et un ban automatique peut être appliqué.

Si OpenAI est indisponible, le dictionnaire local continue de fonctionner.

### Gamification

Les réactions positives ajoutent des points. Les sanctions retirent des points.

Le frontend calcule des badges à différents seuils positifs et négatifs, par exemple :

- Rising Star ;
- Helpful Hero ;
- Fair Play Legend ;
- Caution Mark ;
- Critical Conduct.

Le classement affiche les utilisateurs actifs possédant des points positifs.

## 12. RGPD

### Export

L’utilisateur authentifié peut exporter un JSON lisible contenant notamment :

- compte et profil ;
- fournisseurs OAuth ;
- sessions sans valeur secrète ;
- relations et blocages ;
- conversations et messages ;
- lectures et réactions ;
- notifications ;
- rapports et actions de modération.

Les hashes de mot de passe et valeurs brutes des tokens ne sont pas exportés.

### Demande de suppression

Pour un compte local :

1. l’utilisateur est authentifié ;
2. il fournit son mot de passe ;
3. bcrypt le vérifie ;
4. un token aléatoire est généré ;
5. seule son empreinte est stockée ;
6. un email contient le lien brut ;
7. le lien expire.

Pour un compte uniquement OAuth, la session authentifiée suffit à demander la confirmation.

### Confirmation finale

La page exige une session active.

Le backend vérifie :

- validité et expiration du token ;
- correspondance entre le token et l’utilisateur JWT ;
- mot de passe à nouveau pour un compte local ;
- consommation unique de la demande.

Un utilisateur A utilisant le lien de B reçoit `403`.

### Suppression

La suppression :

- supprime l’avatar du volume ;
- retire les notifications pouvant conserver une identité ;
- traite rapports et actions nécessaires ;
- invalide les hashes de conversation directe ;
- supprime l’utilisateur dans une transaction ;
- profite des cascades Prisma ;
- envoie un email de fin d’opération.

### Rôle de Mailpit

Mailpit est un outil local qui capture les emails. Il permet de démontrer le parcours sans fournisseur SMTP externe.

Même si une personne voit un lien Mailpit, elle ne peut pas supprimer un autre compte sans être connectée comme le propriétaire et, pour un compte local, sans connaître son mot de passe.

Mailpit ne doit pas être exposé comme boîte email de production. Un véritable fournisseur SMTP doit le remplacer en déploiement public.

## 13. Tests et fichiers `.spec.ts`

### Qu’est-ce qu’un fichier `.spec.ts` ?

Un fichier `.spec.ts` contient une spécification de test Jest.

Il décrit :

- le comportement attendu ;
- le scénario ;
- les dépendances simulées ;
- les assertions.

Structure classique :

```text
describe("service", ...)
  beforeEach(...)
  it("refuse un utilisateur non autorisé", ...)
    arrange
    act
    assert
```

### Arrange, Act, Assert

- **Arrange** : préparer données et mocks ;
- **Act** : exécuter la méthode ;
- **Assert** : vérifier le résultat et les appels.

### Mock

Un mock remplace une dépendance réelle.

Exemple : simuler Prisma permet de tester la règle métier sans démarrer PostgreSQL.

Un mock doit rester fidèle au contrat réel. Trop de mocks peuvent masquer un problème d’intégration.

### Tests unitaires

Ils testent une petite unité isolée :

- AuthService ;
- ChatService ;
- permissions admin ;
- stratégie JWT ;
- notifications ;
- RGPD ;
- modération automatique ;
- logger.

État actuel validé :

- 17 suites ;
- 167 tests unitaires ;
- tous réussis.

### Tests E2E

Un test end-to-end démarre l’application NestJS et envoie une vraie requête HTTP. Il vérifie l’intégration de plusieurs couches.

Le projet possède également un test E2E réussi.

### Pourquoi les deux ?

- test unitaire : rapide et précis ;
- test d’intégration : vérifie plusieurs composants ;
- E2E : vérifie le parcours externe ;
- test manuel : vérifie l’expérience navigateur et le temps réel.

### Cas de sécurité testés

Le dépôt contient notamment des tests sur :

- hiérarchie administrateur/modérateur ;
- rôle relu en base ;
- accès à un groupe après départ ou expulsion ;
- notifications temps réel ;
- données privées non retournées par le chat ;
- logs sans secrets ;
- token RGPD appartenant au bon utilisateur ;
- mot de passe RGPD ;
- traitement unique d’un rapport ;
- modération automatique.

## 14. État des modules choisis

Les statuts ci-dessous sont volontairement prudents.

| Module | État | Justification |
|---|---|---|
| Framework frontend et backend | Défendable | Next.js/React et NestJS |
| Temps réel WebSocket | Défendable | Socket.IO, rooms, présence, messages, notifications |
| Interaction entre utilisateurs | Défendable | Amis, blocages, profils, chat, groupes |
| ORM | Défendable | Prisma avec PostgreSQL et migrations |
| Notifications création/mise à jour/suppression | Partiel à défendre avec preuves | Infrastructure complète et nombreux événements, mais vérifier l’exhaustivité de chaque action demandée par le sujet |
| Recherche avancée | Partiel | Recherche, tri et pagination visuelle existent ; filtres et pagination sont surtout côté frontend, pas une API serveur générique paginée |
| Navigateurs supplémentaires | Non prouvé | Aucun rapport de tests multi-navigateurs automatisés |
| Gestion utilisateur et authentification | Défendable | Local, sessions, rôles, profils, sécurité |
| OAuth 2.0 | Fonctionnel mais sécurité partielle | OAuth 42 existe ; `state` reste à ajouter |
| Permissions avancées | Défendable | Guards, rôles, hiérarchie et contrôles métier |
| Système d’organisation | Non implémenté | Aucun modèle `Organization`, équipe ou membership d’organisation |
| Analytics utilisateur | Non implémenté comme dashboard | Points et classement existent, mais pas de véritable tableau d’analyses d’activité |
| IA de modération | Défendable | OpenAI + fallback dictionnaire, sanctions et rapports |
| Chat avancé | Défendable | Groupes, rôles, réactions, lectures, présence, frappe, édition |
| Gamification | Défendable | Points, classement et badges |
| RGPD | Défendable | Export, suppression confirmée et emails |

> **Conseil de soutenance :** ne présente pas un module partiel comme terminé. Montre le code existant, explique la limite et propose précisément l’évolution nécessaire.

## 15. Questions fréquentes de soutenance

### Qu’est-ce qu’une API REST ?

Une API REST expose des ressources via HTTP. Elle utilise des routes, verbes et codes de statut. Le projet suit cette approche pour les utilisateurs, conversations, notifications et rapports.

### Différence entre `GET`, `POST`, `PATCH` et `DELETE` ?

- `GET` lit ;
- `POST` crée ou déclenche une action ;
- `PATCH` modifie partiellement ;
- `DELETE` supprime.

### Qu’est-ce qu’un access token ?

Une preuve de session de courte durée envoyée à l’API. Ici, c’est un JWT bearer stocké en mémoire dans Zustand.

### Qu’est-ce qu’un refresh token ?

Une preuve de session plus longue permettant d’obtenir un nouvel access token. Ici, c’est une valeur aléatoire opaque placée en cookie HttpOnly et hashée en base.

### Où sont stockés les tokens ?

- access token : mémoire JavaScript du frontend ;
- refresh token brut : cookie sécurisé du navigateur ;
- refresh token côté base : uniquement son hash SHA-256.

### Pourquoi ne pas mettre l’access token dans `localStorage` ?

Une injection JavaScript peut lire `localStorage`. Le stockage en mémoire limite la persistance. Le risque XSS n’est pas supprimé, mais l’exposition durable est réduite.

### Pourquoi le refresh token est-il en cookie HttpOnly ?

Pour empêcher JavaScript de le lire. Le navigateur l’envoie automatiquement au serveur.

### JWT est-il chiffré ?

Non. Il est encodé et signé. Son payload est lisible. La signature garantit son intégrité.

### Que se passe-t-il si le JWT est volé ?

Il peut être utilisé jusqu’à son expiration. C’est pourquoi il doit être court, transmis uniquement en HTTPS et jamais journalisé.

### Quelle différence entre `401` et `403` ?

- `401` : identité absente ou invalide ;
- `403` : identité connue mais action interdite.

### Qu’est-ce que bcrypt ?

Une fonction de dérivation lente conçue pour les mots de passe. Elle utilise un sel et un coût configurable.

### Pourquoi un sel ?

Pour que deux mots de passe identiques produisent des hashes différents et pour empêcher les attaques par tables précalculées.

### Pourquoi le sel n’a-t-il pas sa propre colonne ?

Bcrypt intègre algorithme, coût et sel dans la chaîne du hash.

### Hash et chiffrement, quelle différence ?

Le chiffrement est réversible avec une clé. Le hash de mot de passe est volontairement non réversible.

### Qu’est-ce que CORS ?

Une politique navigateur contrôlant quelles origines peuvent appeler l’API. Le backend autorise les origines configurées et les credentials.

### Qu’est-ce que CSRF ?

Une attaque forçant le navigateur d’une victime à envoyer une requête authentifiée. `SameSite`, les contrôles d’origine et les bearer tokens réduisent ce risque.

### Qu’est-ce que XSS ?

L’exécution d’un script malveillant dans l’application. Il faut échapper le contenu, éviter l’injection HTML et protéger les tokens.

### Qu’est-ce qu’OAuth 2.0 ?

Un protocole de délégation permettant à 42 d’autoriser l’application à identifier l’utilisateur sans partager son mot de passe 42.

### À quoi sert `state` dans OAuth ?

À relier le callback à la demande initiale et empêcher le login CSRF. Il doit être aléatoire, stocké temporairement et vérifié une fois.

### Qu’est-ce qu’un WebSocket ?

Une connexion persistante et bidirectionnelle entre client et serveur.

### Pourquoi Socket.IO plutôt que WebSocket brut ?

Pour les événements nommés, rooms, reconnexions et accusés de réception.

### Qu’est-ce qu’une room Socket.IO ?

Un groupe logique de sockets auquel le serveur peut envoyer un événement ciblé.

### Comment empêchez-vous l’accès à un groupe quitté ?

Le backend exige une ligne `ConversationParticipant` avec `leftAt = null`, aussi bien dans le service que lors de l’entrée dans la room.

### Comment gérez-vous plusieurs onglets ?

Le backend associe chaque utilisateur à un ensemble de `socketId`. Il reste en ligne tant qu’au moins une socket existe.

### Pourquoi Redis n’est-il pas utilisé ?

Une seule instance backend suffit actuellement. Redis deviendrait utile pour partager rooms, présence et événements entre plusieurs instances.

### Qu’est-ce que React ?

Une bibliothèque déclarative de composants. L’interface est recalculée à partir des props et de l’état.

### Qu’est-ce qu’un hook ?

Une fonction React donnant accès à l’état, aux effets ou à une logique réutilisable.

### Pourquoi Zustand ?

Pour partager simplement l’utilisateur, l’access token et les notifications entre composants sans prop drilling excessif.

### Qu’est-ce qu’un ORM ?

Une couche qui représente les données relationnelles avec des objets et méthodes du langage. Prisma traduit les opérations typées en requêtes PostgreSQL.

### ORM signifie-t-il qu’on ne doit pas connaître SQL ?

Non. Il faut comprendre relations, index, transactions, contraintes et performances.

### Qu’est-ce qu’une migration ?

Une évolution versionnée de la structure de la base, appliquée de façon reproductible.

### Pourquoi une transaction ?

Pour garantir que plusieurs changements liés réussissent ensemble ou sont tous annulés.

### Différence entre `unique` et `index` ?

`unique` interdit les doublons et crée généralement un index. Un index simple accélère sans forcément interdire les doublons.

### Qu’est-ce qu’un controller NestJS ?

La couche qui expose les routes et délègue la logique.

### Qu’est-ce qu’un service NestJS ?

La couche qui implémente les règles métier et l’accès aux données.

### Qu’est-ce qu’un module NestJS ?

Une unité d’organisation déclarant contrôleurs, providers, imports et exports.

### Qu’est-ce que l’injection de dépendances ?

Le framework fournit automatiquement les objets nécessaires, ce qui réduit le couplage et facilite les tests.

### Qu’est-ce qu’un DTO ?

Le contrat et la validation des données échangées avec une route.

### Pourquoi tester les services ?

Les services contiennent les règles métier les plus critiques. Les tests détectent les régressions sans interface graphique.

### Qu’est-ce qu’un mock ?

Une imitation contrôlée d’une dépendance, par exemple Prisma ou JwtService.

### Différence test unitaire et E2E ?

Le test unitaire isole une fonction ou classe. L’E2E teste le système par son interface externe.

### Pourquoi Docker ?

Pour garantir les mêmes versions, dépendances, réseaux et commandes sur toutes les machines.

### Qu’est-ce qu’un volume Docker ?

Un stockage persistant indépendant du cycle de vie du conteneur.

### Qu’est-ce qu’un reverse proxy ?

Un serveur d’entrée qui reçoit la requête et la transmet au bon service interne.

### Que fournit HTTPS ?

Confidentialité, intégrité et authentification du serveur grâce à TLS.

### Pourquoi `HttpOnly` n’empêche-t-il pas toutes les attaques ?

Il protège la lecture du cookie, mais un script XSS peut encore effectuer des actions au nom de l’utilisateur. Il faut aussi prévenir XSS et limiter les permissions.

### Comment la suppression RGPD est-elle sécurisée ?

Session JWT, token email lié à l’utilisateur, expiration, consommation unique et mot de passe local vérifié une seconde fois.

### Pourquoi Mailpit n’est-il pas une vraie boîte email ?

Mailpit capture localement tous les messages pour le développement. En production, un fournisseur SMTP réel distribue les emails aux destinataires.

### Comment gérez-vous une panne OpenAI ?

L’erreur est enregistrée et la modération locale par dictionnaire continue.

### Comment empêchez-vous un double traitement de rapport ?

La transaction revendique le rapport uniquement si son statut est encore `OPEN`. Une seconde opération ne modifie aucune ligne et échoue.

## 16. Démonstration conseillée

Ordre recommandé :

1. `make up`, puis `docker compose ps` ;
2. montrer HTTPS et le reverse proxy ;
3. inscrire deux utilisateurs ;
4. expliquer access token mémoire et refresh cookie dans les outils navigateur ;
5. créer une conversation directe et montrer son apparition sans refresh ;
6. envoyer, modifier, supprimer et réagir à un message ;
7. montrer présence, frappe et lecture ;
8. créer un groupe, inviter puis expulser un membre ;
9. prouver que le membre expulsé perd l’accès ;
10. bloquer un utilisateur et montrer les indicateurs de recherche ;
11. signaler un message et traiter le rapport ;
12. montrer les rôles et la hiérarchie ;
13. déclencher une modération automatique ;
14. montrer points, classement et badges ;
15. exporter les données RGPD ;
16. demander une suppression, ouvrir Mailpit et confirmer ;
17. terminer par les tests : 167 unitaires et l’E2E.

Pour chaque démonstration, expliquer :

- la route ou l’événement ;
- le guard ;
- le service ;
- la requête Prisma ;
- la mise à jour frontend.

## 17. Limites et améliorations

### Sécurité OAuth

Ajouter `state`, idéalement PKCE, et supprimer les URLs `localhost` codées en dur du callback et de la gateway.

### Recherche avancée

Déplacer pagination, filtres et tri dans l’API :

```text
GET /users/search?q=gu&role=USER&sort=username&page=2&limit=20
```

Retourner total, page, limite et résultats.

### Organisation

Créer des modèles tels que :

```text
Organization
OrganizationMember
OrganizationRole
OrganizationInvitation
```

Puis ajouter permissions, gestion des membres et espaces associés.

### Analytics

Enregistrer des événements d’activité agrégés et créer un tableau de bord :

- connexions ;
- messages ;
- relations ;
- sanctions ;
- évolution des points ;
- activité dans le temps.

Il faut respecter la minimisation RGPD et une durée de conservation.

### Navigateurs

Ajouter Playwright avec une matrice Chromium, Firefox et WebKit.

### Notifications exhaustives

Construire une matrice de toutes les créations, modifications et suppressions attendues par le sujet, puis un test par action.

### Temps réel distribué

Pour plusieurs backends :

- adaptateur Socket.IO Redis ;
- stockage de présence partagé ;
- load balancer ;
- éventuellement sticky sessions selon l’architecture.

### Production publique

La composition utilise un runtime production, mais reste orientée démonstration locale :

- certificat auto-signé ;
- Mailpit ;
- pgAdmin ;
- domaine localhost.

Une production publique devrait utiliser :

- gestionnaire de secrets ;
- certificat reconnu ;
- véritable SMTP ;
- sauvegardes PostgreSQL ;
- rotation des clés ;
- supervision ;
- rate limiting actif ;
- politique CSP ;
- logs centralisés ;
- images épinglées par version ou digest.

### Règle de soutenance

Une bonne réponse n’est pas « tout est parfait ». Une bonne réponse est :

```text
Voici ce qui est implémenté.
Voici la preuve dans l’architecture.
Voici la limite actuelle.
Voici comment je la corrigerais.
```

Cette capacité à distinguer fonctionnement, sécurité, limites et évolution est précisément ce qu’un jury cherche à évaluer.
