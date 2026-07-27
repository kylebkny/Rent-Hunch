-- Half baths. Rentals are commonly listed as 1.5 / 2.5 bath, but the column
-- was an int, so the EXR ingest had to round (losing the half) and the admin
-- form could only offer whole numbers. numeric(3,1) covers 0.5 – 99.9.
alter table listings alter column baths type numeric(3,1);
