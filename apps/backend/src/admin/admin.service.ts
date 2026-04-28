import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";


@Injectable()
export class AdminService {
    constructor (private readonly prisma: PrismaService) {}

    async banUser(targetUserId: string, actorUserId: string) {
        if (targetUserId === actorUserId) {
            throw new BadRequestException('User cannot ban himself...');
        }

        const isTargetUserExist = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            include: { profile: true },
        });

        if (!isTargetUserExist) {
            throw new NotFoundException('User to ban does not exist');
        }

        if (isTargetUserExist.isBanned) {
            throw new BadRequestException('User already banned');
        }

        const [updateUser] = await this.prisma.$transaction([this.prisma.user.update({
            where: { id : targetUserId },
            data : { isBanned: true, isActive: false },
            include : { profile: true },
            }),
            this.prisma.refreshToken.updateMany({
            where: { userId : targetUserId, revokedAt: null },
            data: { revokedAt: new Date() },
            }),
        ]);

        return {
            message: 'user banned',
            user: {
                id: updateUser.id,
                email: updateUser.email,
                username: updateUser.username,
                GlobalRole: updateUser.globalRole,
                isActive: updateUser.isActive,
                isBanned: updateUser.isBanned,
                profile: updateUser.profile ? {
                    displayName: updateUser.profile.displayName,
                    bio: updateUser.profile.bio,
                    avatarUrl: updateUser.profile.avatarUrl
                } : null,
            }
        };
    }

    async unbanUser(targetUserId: string, actorUserId: string) {
        if (targetUserId == actorUserId) {
            throw new BadRequestException("cannot unban yourself");
        }

        const banUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            include: { profile: true },
        });

        if (!banUser) {
            throw new NotFoundException("user does not exist");
        }

        if (banUser.isBanned === false) {
            throw new BadRequestException("user is not banned");
        }

        const updateUser = await this.prisma.user.update({
            where: { id: targetUserId },
            data: { isBanned: false, isActive: true },
            include: { profile: true },
        });

        return {
            message: 'user unbanned',
            user: {
                id: updateUser.id,
                email: updateUser.email,
                username: updateUser.username,
                globalRole: updateUser.globalRole,
                isActive: updateUser.isActive,
                isBanned: updateUser.isBanned,
                profile: updateUser.profile ? {
                    displayName: updateUser.profile.displayName,
                    bio: updateUser.profile.bio,
                    avatarUrl: updateUser.profile.avatarUrl
                } : null,
            }
        };
    }

    async promoteUserToModerator(targetUserId: string, actorUserId: string) {
        //As admin, this corner case is not possible (as not user)
        // if (targetUserId == actorUserId) {
        //     throw new BadRequestException("cannot promote yourself");
        // }

        const promoteUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            include: { profile: true },
        });

        if (!promoteUser) {
            throw new NotFoundException("user does not exist");
        }

        if (promoteUser.globalRole !== 'USER') {
            throw new BadRequestException("promotee is not USER");
        }

        if (promoteUser.isBanned === true) {
            throw new BadRequestException("user is banned");
        }

        const updateUser = await this.prisma.user.update({
            where: { id: targetUserId },
            data: { isBanned: false, isActive: true, globalRole: 'MODERATOR', },
            include: { profile: true },
        });

        return {
            message: 'user promoted to moderator',
            user: {
                id: updateUser.id,
                email: updateUser.email,
                username: updateUser.username,
                globalRole: updateUser.globalRole,
                isActive: updateUser.isActive,
                isBanned: updateUser.isBanned,
                profile: updateUser.profile ? {
                    displayName: updateUser.profile.displayName,
                    bio: updateUser.profile.bio,
                    avatarUrl: updateUser.profile.avatarUrl
                } : null,
            }
        };
    }

    async unpromoteModeratorToUser(targetUserId: string, actorUserId: string) {
        //As admin, this corner case is not possible (as not moderator)
        // if (targetUserId == actorUserId) {
        //     throw new BadRequestException("cannot promote yourself");
        // }

        const unpromoteModerator = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            include: { profile: true },
        });

        if (!unpromoteModerator) {
            throw new NotFoundException("user does not exist");
        }

        if (unpromoteModerator.globalRole !== 'MODERATOR') {
            throw new BadRequestException("promotee is not MODERATOR");
        }

        if (unpromoteModerator.isBanned === true) {
            throw new BadRequestException("moderator is banned");
        }

        const updateUser = await this.prisma.user.update({
            where: { id: targetUserId },
            data: { isBanned: false, isActive: true, globalRole: 'USER', },
            include: { profile: true },
        });

        return {
            message: 'moderator unpromoted to user',
            user: {
                id: updateUser.id,
                email: updateUser.email,
                username: updateUser.username,
                globalRole: updateUser.globalRole,
                isActive: updateUser.isActive,
                isBanned: updateUser.isBanned,
                profile: updateUser.profile ? {
                    displayName: updateUser.profile.displayName,
                    bio: updateUser.profile.bio,
                    avatarUrl: updateUser.profile.avatarUrl
                } : null,
            }
        };
    }
}