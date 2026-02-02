SELECT page_id, page_namespace, HEX(page_title) AS page_title FROM page WHERE page_is_redirect = 0;
