# Changelog
##  1.26.2 July 26 2018

Added a way for a page to ask the address of the extension's wallet. Only verified sites will be able to get it. Happens through postMessage.
Fixed an issue with date inputs in the profile page.

##  1.26.1 July 11 2018

Fix for the statistics view in the popup. The local history broke when the extension wasn't used for more than 24 hours.

## 1.26 Jun 20 2018

- Added filters to the requests sent and rewarded for the airdrop. Only ads are rewarded now, not analytics scripts that are loaded over and over on streaming videos for example. We thnk this will make the airdrop repartition fairer.
You can see the blocked requests (grey) and rewarded requests (green) statistics in the statistics panel in the popup.
- Added a captcha step when creating or importing a new wallet that hasn't been validated yet. This is to avoid bot abuse and once again make the airdrop repartition fairer.
No reward will be allocated before the captcha is validated. Wallets created/imported before the update will be considered validated.
- Added a notification system in the popup to let you know when something big is coming. We won't use it too much and it's not intrusive at all (just a little text at the top of the popup that you can remove).
- Improved the way the 12 word seed is displayed when creating a wallet to avoid misunderstanding and users writing down only 6 words.
Added the possibility to save the seed to file.
- Added persistence of the overlay when closing the popup. It was annoying that the wallet creation process was reset if the popup was closed. Fields are still reset for safety though.
- Forced 8 characters minimum on password
- Added loading indicators on the popup balance and profile page.
- Improved total requests blocked display (reduce font to avoid line break with big numbers)
- Improved profile page (birth date input)


##  1.25.2 June 03 2018

Prepare firefox release:
- make bundle lighter by removing useless aws sdk libs
- fix make scripts


##  1.25.1 May 31 2018

- various fixes (popup toggle, ...)
- keyring controller bump to 3.1.4
- improvements to profile page (countries list, language list, industries list, init from config, fix error messages, fix password login)

## 1.25 May 21 2018

- Added the data wallet and profile page in the settings
- (DEV) added nom scripts

## 1.24 May 08 2018

- Created and integrated a new popup design from scratch

## 1.23 May 01 2018 (quick one for publishing, doesn't appear in github history)

- updated api endpoints

## 1.22 Apr 29 2018

- added wallet reset
- bumped keyring version to 3.1.1 to fix some bugs that necessitated workarounds

## 1.21 Apr 18 2018

- updated icons
- added airdrop disclaimer

## 1.20 Apr 17 2018

- added a generic info overlay. Used it to display referral success
- fixed advanced settings/firewall view that was deactivated previously
- updated description files
- added error handling in overlays

## 1.19 Apr 14 2018

- Added referral system
- Added installation signaling to the API to receive the installation reward
- Fixed minor issues:
  * added wallet settings update function to avoid forgetting to save & clean code
  * improved wallet display in popup (start blank, update popup data before displaying after import)

## 1.18 Apr 11 2018

- update reward after wallet import
- send page hash and blocked url hash to kinesis updates for fraud detection

## 1.17 Apr 10 2018

- follow updated API url
- added the possibility to only import a wallet address instead of a full wallet (for people who want to get their airdrop tokens on their main address but don't trust us to handle it securely)
- updated the "about" page in the settings
- added Varanida logo in settings
