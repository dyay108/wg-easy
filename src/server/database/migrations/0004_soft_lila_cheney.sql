ALTER TABLE `clients_table` ADD `egress_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `clients_table` ADD `egress_device` text;