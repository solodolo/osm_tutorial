CREATE TABLE enwiki_page (
	page_id BIGSERIAL PRIMARY KEY,
	page_namespace bigint not null default 0,
	page_title BYTEA NOT NULL DEFAULT ''
);
