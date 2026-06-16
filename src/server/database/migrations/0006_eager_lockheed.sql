CREATE TABLE `acl_config_table` (
	`id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`allow_public_egress` integer DEFAULT false NOT NULL,
	`exit_node_client_id` integer,
	`default_policy` text DEFAULT 'drop' NOT NULL,
	`filter_table_name` text DEFAULT 'wg_acl_v4' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `interfaces_table`(`name`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `acl_rules_table` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`interface_id` text NOT NULL,
	`source_cidr` text NOT NULL,
	`destination_cidr` text NOT NULL,
	`protocol` text NOT NULL,
	`ports` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`description` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`interface_id`) REFERENCES `interfaces_table`(`name`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `clients_table` ADD `is_exit_node` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `clients_table` ADD `egress_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `clients_table` ADD `egress_device` text;