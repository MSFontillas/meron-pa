# Meron Pa? product catalog

Data behind the app's own barcode list.

Contains information from Open Food Facts (and its sister projects Open Beauty Facts, Open Products Facts
and Open Pet Food Facts), made available under the [ODbL 1.0](LICENSE). Thank you to its contributors.

| File | What it is | Who changes it |
| --- | --- | --- |
| `off/*.json` | Copy of the Open *Facts products sold in the Philippines. refreshed monthly by `.github/workflows/catalog.yml`. | The workflow. Do not edit by hand. |
| `products.csv` | Our own rows. They win over the copy above. | The admin, in GitHub's web editor or any spreadsheet. |
| `sent-to-off.txt` | Barcodes already given back to Open Food Facts. | The workflow. |

## products.csv columns

| Column | Required | Rule |
| --- | --- | --- |
| `barcode` | yes | 8, 12 or 13 digits with a correct check digit |
| `name` | yes | 1 to 40 characters |
| `brand` | no | Only used when giving the product to Open Food Facts |
| `size` | no | At most 30 characters, for example `45 g` or `1 L` |
| `kind` | yes | One of: Food & drinks, Laundry, Bathroom, Cleaning, Baby, Other |
| `give_back` | no | `yes` = send this product to Open Food Facts if it does not have it |

A bad row stops the build and the error names the line.

`npm run catalog:build` writes `public/catalog.json` (it also runs before `npm run build`).
