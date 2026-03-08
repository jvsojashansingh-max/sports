import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { UpdateMeDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        defaultCityId: true,
      },
    });

    if (!user) {
      throw new NotFoundException('NOT_FOUND');
    }

    const vendor = await this.prisma.vendor.findFirst({
      where: {
        ownerUserId: userId,
        status: 'APPROVED',
      },
      select: { id: true },
    });

    return {
      id: user.id,
      role: user.role,
      vendorId: vendor?.id ?? null,
      defaultCityId: user.defaultCityId,
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    let updated;
    try {
      updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          displayName: dto.displayName,
          defaultCityId: dto.defaultCityId,
        },
        select: {
          id: true,
          role: true,
          defaultCityId: true,
        },
      });
    } catch {
      throw new NotFoundException('NOT_FOUND');
    }

    const vendor = await this.prisma.vendor.findFirst({
      where: {
        ownerUserId: userId,
        status: 'APPROVED',
      },
      select: { id: true },
    });

    return {
      id: updated.id,
      role: updated.role,
      vendorId: vendor?.id ?? null,
      defaultCityId: updated.defaultCityId,
    };
  }
}
