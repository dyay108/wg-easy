ALTER TABLE `acl_group_table` ADD `kind` text DEFAULT 'static' NOT NULL;--> statement-breakpoint
INSERT INTO `acl_group_table` (`interface_id`, `name`, `kind`) SELECT `name`, 'All', 'all' FROM `interfaces_table`;
