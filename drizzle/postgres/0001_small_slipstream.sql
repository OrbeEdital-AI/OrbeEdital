ALTER TABLE "opportunities" ADD COLUMN "control_number" text;--> statement-breakpoint
CREATE UNIQUE INDEX "opportunities_control_number_unique" ON "opportunities" USING btree ("control_number");