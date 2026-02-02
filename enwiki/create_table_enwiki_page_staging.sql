CREATE TABLE enwiki_page_staging (
	page_id BIGSERIAL PRIMARY KEY,
	page_namespace bigint not null default 0,
	page_title VARCHAR(1023) NOT NULL DEFAULT ''
);
