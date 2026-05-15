import { Module } from '@nestjs/common';
import { ImportExportController } from './import-export.controller';
import { ImportVendorsService } from './import-vendors.service';
import { ImportClientsService } from './import-clients.service';
import { VendorsModule } from '../vendors/vendors.module';
import { ClientsModule } from '../clients/clients.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [VendorsModule, ClientsModule, OrdersModule],
  controllers: [ImportExportController],
  providers: [ImportVendorsService, ImportClientsService],
})
export class ImportExportModule {}
