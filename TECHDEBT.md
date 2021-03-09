# Tech debt

### File Conversion Service
Observed: January 2021
Impact: (if this tech debt affected your work somehow, add a +1 here with a
date and optionally a note)
+1 Christopher 2021 Jan 15 — This is an example of a +1
##### Problem:
The current file conversion service for Explorer (converts JSON to TSV/CSV for download)
is located on the frontend. Ideally, we'd like to place this on the server side, however,
Graphql does not play nice with non-object data types. The conversion service resolves the requested
file type to a *string*, which creates some Graphql issues. You might ask, just return the string in a JSON?
Returning the data is not the *direct* issue. We can resolve to a string and return
the data from the API back to the user for download no problem. The issue arises because
we have the Query page in portal that allows users to interact with Graphql (via Guppy), and
if we were to simply return a JSON, Graphql will populate all of the user's requested query field
properties as null. This is not ideal. Small example of this requesting with CSV format:
```gql
query {
    subject(format: CSV) {
        name
        gender
    }
}
```
```js
{
    "data": {
        "subject": [
            {
                "name": null,
                "gender": null
            }
        ]
    }
}
```
When really, the conversion service (when moved to the server side) returned:
```js
{
    "data": {
        "subject": ['name,gender/r/n4xotff,unknown/r/nhzv1z,male']
            }
}
```

For now, the Query page in portal will always return JSON to avoid any null returns or impractical user experience.

##### Why it was done this way:
The conversion service as is on the frontend solves the issue of downloading TSV, CSV (and potentially
other file types in the future). After Guppy returns the JSON from Graphql, the conversion service converts it,
and the user has their requested file type downloaded. We do all this and preserve JSON for the Query page, so it is stable
until we come up with a more elegant solution.

##### Why this way is problematic:
This is problematic because it hinders portability. We would like
for the conversion service to be hit from the server side somehow.
Better yet, we would like to keep this conversion service within Guppy.

##### What the solution might be:
Isolate the conversion service to its own environment outside of Guppy,
perhaps an S3 bucket where users can fetch their downloaded file type.

##### Why we aren't already doing the above:
This requires extensive testing and setup and it is not
*critical* to implement. The current conversion service in the frontend
is sufficient and fast for now.

##### Next steps:
Explore other options besides the ones mentioned above, maybe Graphql will
play nicer with data that resolves to non-object data types in the future.

##### Other notes:
Discussed various approaches with the team but decided this is sufficient for now.

##### Design Doc:
Visit the [design doc](https://docs.google.com/document/d/1T40eS5zQbcRESCBlyuEKgw10AdzJaZorj0JIGtBz7NI/edit?usp=sharing)
for more information on the conversion service.
