DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "labs"."games_topics"
		WHERE "slug" = 'rhobh'
	) THEN
		IF EXISTS (
			SELECT 1
			FROM "labs"."games_topics"
			WHERE "slug" = 'reality'
		) THEN
			RAISE EXCEPTION 'cannot rename games_topics slug rhobh: reality already exists';
		END IF;

		UPDATE "labs"."games_topics"
		SET "slug" = 'reality', "updated_at" = now()
		WHERE "slug" = 'rhobh';
	END IF;
END
$$;
