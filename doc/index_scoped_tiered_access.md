# Index-scoped Tiered-Access

Most commons use a site-wide tiered access configuration that applies across indices. However, some use cases require index-scoped permissioning. One example is the case of an open-access study viewer where studies have a mix of public properties and controlled-access properties. Another example is a Data Explorer that presents data types with different permission requirements meant to serve a variety of audiences. For these use cases, tiered-access settings can be specified at the index-level rather than the site-wide level. 

Guppy expects that either all indices in the guppy config block will have a tiered-access level set OR that a site-wide tiered-access level is set in the global block of the manifest. Guppy will throw an error if the config settings do not meet one of these two expectations.

You can set index-scoped tiered-access levels using the `tier_access_level` properties in the guppy block of a common's `manifest.json`. Note that the `tier_access_limit` setting is still site-wide and configurable in the manifest's `global` block.
```
...
"guppy": {
    "indices": [
      {
        "index": "subject_regular",
        "type": "subject",
        "tier_access_level": "regular"
      },
      {
        "index": "subject_private",
        "type": "subject_private",
        "tier_access_level": "private"
      },
      {
        "index": "file_private",
        "type": "file",
        "tier_access_level": "private"
      },
      {
        "index": "studies_open",
        "type": "studies_open",
        "tier_access_level": "libre"
      },
      {
        "index": "studies_controlled_access",
        "type": "studies_controlled_access",
        "tier_access_level": "private"
      }
    ],
    "auth_filter_field": "auth_resource_path",
    ...
  },
```
