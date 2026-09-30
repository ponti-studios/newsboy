CREATE SCHEMA IF NOT EXISTS "labs";
--> statement-breakpoint
CREATE TABLE "labs"."covid_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"iso_code" text,
	"continent" text,
	"location" text,
	"date" date,
	"total_cases" real,
	"new_cases" real,
	"new_cases_smoothed" real,
	"total_deaths" real,
	"new_deaths" real,
	"new_deaths_smoothed" real,
	"total_cases_per_million" real,
	"new_cases_per_million" real,
	"new_cases_smoothed_per_million" real,
	"total_deaths_per_million" real,
	"new_deaths_per_million" real,
	"new_deaths_smoothed_per_million" real,
	"reproduction_rate" real,
	"icu_patients" real,
	"icu_patients_per_million" real,
	"hosp_patients" real,
	"hosp_patients_per_million" real,
	"weekly_icu_admissions" real,
	"weekly_icu_admissions_per_million" real,
	"weekly_hosp_admissions" real,
	"weekly_hosp_admissions_per_million" real,
	"total_tests" real,
	"new_tests" real,
	"total_tests_per_thousand" real,
	"new_tests_per_thousand" real,
	"new_tests_smoothed" real,
	"new_tests_smoothed_per_thousand" real,
	"positive_rate" real,
	"tests_per_case" real,
	"tests_units" text,
	"total_vaccinations" bigint,
	"people_vaccinated" bigint,
	"people_fully_vaccinated" bigint,
	"total_boosters" bigint,
	"new_vaccinations" real,
	"new_vaccinations_smoothed" real,
	"total_vaccinations_per_hundred" real,
	"people_vaccinated_per_hundred" real,
	"people_fully_vaccinated_per_hundred" real,
	"total_boosters_per_hundred" real,
	"new_vaccinations_smoothed_per_million" real,
	"new_people_vaccinated_smoothed" real,
	"new_people_vaccinated_smoothed_per_hundred" real,
	"stringency_index" real,
	"population_density" real,
	"median_age" real,
	"aged_65_older" real,
	"aged_70_older" real,
	"gdp_per_capita" real,
	"extreme_poverty" real,
	"cardiovasc_death_rate" real,
	"diabetes_prevalence" real,
	"female_smokers" real,
	"male_smokers" real,
	"handwashing_facilities" real,
	"hospital_beds_per_thousand" real,
	"life_expectancy" real,
	"human_development_index" real,
	"population" bigint,
	"excess_mortality_cumulative_absolute" real,
	"excess_mortality_cumulative" real,
	"excess_mortality" real,
	"excess_mortality_cumulative_per_million" real
);
--> statement-breakpoint
CREATE TABLE "labs"."rhobh_daily_puzzles" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_utc" date,
	"answer" text NOT NULL,
	"answer_type" text NOT NULL,
	"normalized_answer" text NOT NULL,
	"clue" text NOT NULL,
	"detail" text NOT NULL,
	"sources" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "normalized_answer_length" CHECK (length("labs"."rhobh_daily_puzzles"."normalized_answer") = 5)
);
--> statement-breakpoint
CREATE TABLE "labs"."case_updates" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"raw_content" text NOT NULL,
	"neutral_content" text NOT NULL,
	"round" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labs"."relationship_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"label" text,
	"raw_situation" text NOT NULL,
	"neutral_situation" text NOT NULL,
	"question" text NOT NULL,
	"quorum_size" integer DEFAULT 3 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labs"."relationship_verdicts" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"update_id" text,
	"update_round" integer DEFAULT 0 NOT NULL,
	"user_id" text,
	"fingerprint" text NOT NULL,
	"value" text NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labs"."tfl_cameras" (
	"id" serial PRIMARY KEY NOT NULL,
	"tfl_id" text NOT NULL,
	"common_name" text NOT NULL,
	"available" boolean,
	"image_url" text,
	"video_url" text,
	"view" text,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tfl_cameras_tfl_id_unique" UNIQUE("tfl_id")
);
--> statement-breakpoint
ALTER TABLE "labs"."case_updates" ADD CONSTRAINT "case_updates_case_id_relationship_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "labs"."relationship_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."relationship_verdicts" ADD CONSTRAINT "relationship_verdicts_case_id_relationship_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "labs"."relationship_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labs"."relationship_verdicts" ADD CONSTRAINT "relationship_verdicts_update_id_case_updates_id_fk" FOREIGN KEY ("update_id") REFERENCES "labs"."case_updates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_updates_case_id_idx" ON "labs"."case_updates" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "relationship_verdicts_case_id_idx" ON "labs"."relationship_verdicts" USING btree ("case_id");