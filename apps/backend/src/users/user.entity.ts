// user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;                     // identifiant unique (UUID)

  @Column({ unique: true })
  email: string;                  // email unique

  @Column({ unique: true })
  username: string;               // nom d’utilisateur unique

  @Column({ nullable: true })
  passwordHash: string;           // mot de passe hashé

  @Column({ nullable: true, type: 'text' })
  bio: string;                    // bio facultative

  @Column({ default: 'USER' })
  globalRole: string;             // rôle global (USER, ADMIN…)

  @Column({ default: true })
  isActive: boolean;              // compte actif ou non

  @Column({ default: false })
  isBanned: boolean;              // compte banni ou non

  @Column({ default: 0 })
  penaltyPoints: number;          // points de pénalité

  @Column({ default: 'en' })
  preferredLanguage: string;      // langue préférée

  @Column({ nullable: true })
  avatar: string;                 // clé ou nom du fichier avatar dans MinIO

  @CreateDateColumn()
  createdAt: Date;                // date de création

  @UpdateDateColumn()
  updatedAt: Date;                // date de dernière modification
}