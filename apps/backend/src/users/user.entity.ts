export class User {
  id: string;                     // identifiant unique (UUID)
  email: string;                  // email unique
  username: string;               // nom d’utilisateur unique
  passwordHash?: string;          // mot de passe hashé
  bio?: string;                   // bio facultative
  globalRole: string;             // rôle global (USER, ADMIN…)
  isActive: boolean;              // compte actif ou non
  isBanned: boolean;              // compte banni ou non
  penaltyPoints: number;          // points de pénalité
  preferredLanguage: string;      // langue préférée
  avatar?: string;                // clé ou nom du fichier avatar dans MinIO
  createdAt: Date;                // date de création
  updatedAt: Date;                // date de dernière modification
}
