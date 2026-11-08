import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { EquipmentsService } from './equipments.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { Cacheable } from '../common/decorators/cacheable.decorator';
import { InvalidateCache } from '../common/decorators/invalidate-cache.decorator';

@ApiTags('equipaments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('equipments')
export class EquipmentsController {
  constructor(private readonly equipmentsService: EquipmentsService) {}

  @Roles(UserRole.ADMIN)
  @InvalidateCache(['equipments', 'dashboard'])
  @Post()
  create(@Body() createEquipmentDto: CreateEquipmentDto) {
    return this.equipmentsService.create(createEquipmentDto);
  }

  @Cacheable({ namespace: 'equipments', ttl: 60 })
  @Get()
  findAll(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.equipmentsService.findAll(
      skip ? +skip : undefined,
      take ? +take : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.equipmentsService.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @InvalidateCache(['equipments', 'dashboard'])
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEquipmentDto: UpdateEquipmentDto,
  ) {
    return this.equipmentsService.update(id, updateEquipmentDto);
  }

  @Roles(UserRole.ADMIN)
  @InvalidateCache(['equipments', 'dashboard'])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.equipmentsService.remove(id);
  }
}
