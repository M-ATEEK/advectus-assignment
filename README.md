# Business ID enrichment service

Corporate customers arrive in a car dealership's customer register as CSV lists that often carry only a business ID
(Y-tunnus) or a company name. This service takes such a CSV, completes every row from the Finnish Patent and
Registration Office's open YTJ data, returns the result as normalized JSON, and maps each company to a record that is
easy to import into a customer register such as NetSuite.

Node.js (ES modules, plain JavaScript), Express 5, PostgreSQL (Sequelize), Redis (BullMQ), and a small one-page React
view (Vite) for uploading a file, watching the job and browsing the results.



## architect diagram
  https://drive.google.com/file/d/17z98vGoKV8muhA2gCzD6y3XyepKVauQD/view?usp=sharing

## how do you think about the solution,
The assignment requirement seems simple but its solution should be enough to handle few dozen rows of csv or tens of thousands rows of csv with businessId and company name details. To implement the solution for production grade applications 
in which we can have thousands of business Ids rather then just 10 or 20 rows of csv, we need to think out of boundary. and for this purpose i utilized BULLMQ, Redis, Jobs queues and postgresql as storage mechanism.

The PRH api which you provided does not allow to get all the data of companies of businesses in one call, because they have limit on their api call and also their api is paginated. So we need a solution which can get all the data of the PRH once and then we can utilize it freely. I have implemented Storage and registered all the data of PRH before utlizing it and implemented PRH api call as fallback.

PRH publishes the whole Trade Register as one ZIP (`/v3/all_companies`, 97 MB, 1.46 GB of JSON, 465,408 companies).
A daily job streams it into PostgreSQL in about four minutes. Enrichment then resolves rows locally in milliseconds
and never puts load on PRH.

The PRH API is used only for companies missing from that register, such as sole traders and associations (the ZIP covers the Trade Register only) and companies registered since the last dump. 

I am using the BullMQ with redis and processing the uploaded or fetched zip file of PRH with BullMQ by spliting it into chunks of rows of 1000. This mechanism helps to process the zip file in backrgound and store its data into storage to use later on, so that when data is required we do not need to call the PRH api again.

My provided solution supports large csv files to import for customer register and it process the data by background jobs. The whole process for user end never halts browser and node thread. This solution also does not put load on PRH server because i am using postgresql as cache or storage place to normalize the data set.


## What assumptions did you make and why
- The csv file of the 20 or 50 business ids can be larger also to match with PRH data because as system will grow on production it should be able to handle large data set by jobs and queues.
- A valid ID that PRH knows is a match even when the CSV name differs (a `NAME_MISMATCH` warning is attached). Names are only consulted when the ID is missing, malformed or unknown.
- If the ID does not match then use the exact name match to normalize the data from PRH data set.
- ACTIVE means no end date and no bankruptcy or liquidation situation because PRH does not document its numeric `status`
  codes.
- VAT number is `FI` + the ID digits, but only when PRH lists the company as VAT-liable for business (register entry 80).
  Printing a VAT number for a non-VAT-registered company would be wrong, so the field stays empty instead.
- Data older than a day is stale.PRH regenerates the dump nightly, so the loader runs at 05:30 Helsinki time and
  the `dataset` endpoint reports the age.
- We cannot use the PRH given api to match the bunsiness Id from CSV because its paginated and if we pass business id in the PRH api by query params then rate limit restrict us to do multiple calls.

## Decisions, and why
- 
- Loaded the full register instead of calling PRH per row because Per-row calls would hit the rate limit on any real file and
  make a 10,000-row CSV take hours. The dump makes enrichment independent of PRH's availability during the day.
- PostgreSQL for the register and did not used Redis, because there are limitations of redis in memory so postgresql is better option.
- Upsert into the live table from zip file of PRH with import date time because its better to store the PRH data in db rather then directly search from zip file
- Processing the csv rows in chunks so it can large data and each chunk is processed by job.
- Sequelize + Umzug. Models, migrations and seeders like an Eloquent/Mongoose setup of laravel.


## What I left out, and what I would do next
I have implemented all the requirements of the assignment in the better way so that we can handle large csv files for customer register.

## How I used AI tools
I have used the AI tool to implement the code in small chunks, while the approach, design, problem solving technique and handling large data set csv files, these all are mine, The structure of project is also my own designed.
Claude is used only to implement the code in small pieces.