CREATE TABLE `acl_group_table` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`interface_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`interface_id`) REFERENCES `interfaces_table`(`name`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `acl_group_member_table` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`client_id` integer,
	`cidr` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `acl_group_table`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients_table`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_acl_rules_table` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`interface_id` text NOT NULL,
	`source_cidr` text,
	`destination_cidr` text,
	`source_group_id` integer,
	`destination_group_id` integer,
	`protocol` text NOT NULL,
	`ports` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`description` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`interface_id`) REFERENCES `interfaces_table`(`name`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`source_group_id`) REFERENCES `acl_group_table`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`destination_group_id`) REFERENCES `acl_group_table`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_acl_rules_table`("id", "interface_id", "source_cidr", "destination_cidr", "source_group_id", "destination_group_id", "protocol", "ports", "enabled", "description", "created_at", "updated_at") SELECT "id", "interface_id", "source_cidr", "destination_cidr", NULL, NULL, "protocol", "ports", "enabled", "description", "created_at", "updated_at" FROM `acl_rules_table`;--> statement-breakpoint
DROP TABLE `acl_rules_table`;--> statement-breakpoint
ALTER TABLE `__new_acl_rules_table` RENAME TO `acl_rules_table`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
