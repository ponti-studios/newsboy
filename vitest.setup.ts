// Tests always use the Docker db-test service, regardless of local or CI env files.
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:4433/hominem-test";
process.env.NEWSBOY_APP_URL ??= "http://localhost:5173";
