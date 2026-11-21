# BRIEF-v4 addendum, D143 (2026-11-21)

Read this WITH BRIEF-v4 and the D141 addendum. Where they conflict, this
addendum wins.

It applies from 2026-11-21 (the rwxlite r15 review rows and later). Burned
exam truth is never relabelled by it. Classes stay r < w < x.

## Creating a booking or reservation is x

Creating a booking or reservation is x by BRIEF-v4 clause d (commits to an
outside party), whatever the text names: a booking commits to an outside
party, and its text cannot show whether that party is an airline, hotel or
restaurant.

- POST /bookings, "Create booking": x
- POST /restaurant/{restaurant}/reserve, "Create a reservation": x
- POST /stays/bookings, "Create a stays booking": x
