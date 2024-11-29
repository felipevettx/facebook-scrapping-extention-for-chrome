import { LogService, ScraperService } from '../../shared/services';
import { ScraperResults, Market, ScrapedVehicle, MarketParams } from '../../shared/interfaces';
import { ExecutionStatus, DealershipSettingsTypes, MarketSettingsTypes } from '../../shared/enums';
import {
  getParams,
  hasIgnoreTerm,
  randomSleep,
  removeUtf8EscapedCharacters,
  sleep,
  isLocationWithinBoundary,
} from '../../shared/helpers';
import { convertTotalOwnersStringToNumber, getFacebookRadius, getMarketUrl } from './facebook-helper';
import { DateTime } from 'luxon';
import * as fs from 'fs';
import { SCRAPER_DEFAULT_SETTINGS } from '../../shared';
import { VEHICLE_ATTRIBUTES } from '../../shared/enums/vehicle-attributes.enum';
import { initAuth, initVPN } from './facebook-auth-helper';

/**
 * @description Execute the facebook scraper
 * @param _market - The market to scrape
 * @param _logger - The logger service
 * @param _scraper - The scraper service
 *
 */
export const executeScraper = async (
  _market: Market,
  _logger: LogService,
  _scraper: ScraperService,
): Promise<ScraperResults> => {
  try {
    // Process the market
    const executionResults = await processMarket(_market, _logger, _scraper);

    // If results are 0 and there is the possibility of a soft block, return an error.
    if (executionResults?.totalVehicles === 0) {
      await _scraper.takeScreenshot('facebook-no-results');
      throw new Error(`No results found - ${_market.account?.username ?? 'Possible soft block or VPN error`'}`);
    }

    // Close the scraper
    await _scraper.closeScraper();

    return executionResults;
  } catch (error) {
    await sleep(10000);

    _logger.error(error);

    // Close the scraper
    await _scraper.closeScraper();

    return {
      success: false,
      executionStatus: ExecutionStatus.Error,
      executionMessage: error.message,
      totalVehicles: 0,
      skippedVehicles: 0,
      validVehicles: 0,
      results: [],
    };
  }
};

export async function processFacebookMarketUrls(
  facebookMarketUrls: string[],
  _scraper: ScraperService,
  _logger: LogService,
  _market: Market,
  params: MarketParams,
  maxResults: number,
  maxExecutionTimeSeconds: number,
  centerCoordinate: { latitude: number; longitude: number },
  enforceRadius: boolean,
  dealershipExcludedKeywords: string[],
  startTime: [number, number], // process.hrtime() start time
  executionResults: ScraperResults,
  scrapedVehicles: ScrapedVehicle[],
  skippedVehicles: ScrapedVehicle[],
  usingVPN = false,
): Promise<void> {
  let stopExecution = false;
  let countContinuousErrors = 0;

  let skipSetRadius = false;

  const continuousErrorsLimit = 5;
  let continuousErrors = 0;

  const foundLinks: string[] = [];
  const firstLink = facebookMarketUrls?.[0];

  // Process the main pages to get the vehicle links
  for (const facebookMarketUrl of facebookMarketUrls) {
    try {
      _scraper.onlyHTML = false; // Allow scraper to load more content
      _logger.log(`Navigating to ${facebookMarketUrl}`);
      await _scraper.navigateToUrl(facebookMarketUrl, 36);
      await randomSleep();
      await clearPageBlock(_scraper);

      const facebookRadius = getFacebookRadius(params.searchRadius);

      const pageLinks = await getLinks(facebookRadius, _market.id, _scraper, _logger, skipSetRadius, usingVPN);
      skipSetRadius = true;

      countContinuousErrors = 0;

      if (pageLinks.length === 0) {
        // If no links are found on the first page, stop the execution and log the error
        if (firstLink === facebookMarketUrl) {
          _logger.log(`No vehicles found on the first page for ${facebookMarketUrl}`);
          executionResults.success = false;
          executionResults.executionStatus = ExecutionStatus.Error;
          executionResults.executionMessage = 'No vehicles found on the first page';
          break;
        }

        _logger.log(`No vehicles found on the page for ${facebookMarketUrl}`);

        continue;
      }

      // Filter out the links that have already been processed or are duplicates
      const filteredLinks = pageLinks.filter((link) => !foundLinks.includes(link));
      const links = Array.from(new Set(filteredLinks));

      if (links.length === 0) {
        _logger.log(`No new vehicles found on the page for ${facebookMarketUrl}`);
        continue;
      }

      // Add the links to the found links
      foundLinks.push(...links);

      _logger.log(`Found ${links.length} new vehicles on the page for ${facebookMarketUrl}`);

      if (stopExecution) break;
    } catch (err) {
      _logger.log(`Error navigating to ${facebookMarketUrl}`);
      _logger.error(err);

      continuousErrors++;
    }

    if (continuousErrors >= continuousErrorsLimit) {
      _logger.log(`Too many errors in a row, stopping execution`);
      executionResults.success = false;
      executionResults.executionStatus = ExecutionStatus.Error;
      executionResults.executionMessage = 'Too many errors in a row';
      break;
    }
  }

  // Get unique links
  const links = Array.from(new Set(foundLinks));

  if (links.length === 0) {
    _logger.log(`No unique links found`);
    return;
  }

  _logger.log(`Found ${links.length} unique links`);
  _logger.log(`Processing vehicle details`);

  if (!usingVPN) {
    // Close the scraper and use a new session with the VPN to load the details page
    _logger.log('Using VPN to load the vehicle details');

    // Close the scraper
    await _scraper.closeScraper();
    await randomSleep();

    // Initialize the scraper with VPN
    await initVPN(_logger, _scraper);
  }

  // Process all of the unique links generated from the main pages
  _scraper.onlyHTML = true;

  for (const link of links) {
    if (await handleExecutionTimeout(startTime, maxExecutionTimeSeconds, _logger)) {
      stopExecution = true;
      break;
    }

    try {
      await randomSleep(2000, 1000);
      const vehicleDetails = await getVehicleDetails(_scraper, _logger, link);

      if (!vehicleDetails.originalTitle) {
        logVehicleError(_logger, link, executionResults);
        countContinuousErrors++;
        continue;
      }

      await handleVehicleExpiration(vehicleDetails, params, _logger);

      if (
        await handleVehicleValidation(
          vehicleDetails,
          params,
          enforceRadius,
          centerCoordinate,
          dealershipExcludedKeywords,
          _logger,
          skippedVehicles,
        )
      ) {
        continue;
      }

      scrapedVehicles.push(vehicleDetails);
      executionResults.validVehicles++;

      if (executionResults.validVehicles >= maxResults) {
        _logger.log(`Reached the maximum number of vehicles`);
        stopExecution = true;
        break;
      }
    } catch (err) {
      logProcessingError(_logger, err, link, executionResults);
      countContinuousErrors++;
      if (countContinuousErrors > 5) {
        _logger.log(`Too many errors in a row, stopping execution`);
        executionResults.executionMessage = 'Too many errors in a row';
        stopExecution = true;
        break;
      }
    }
  }

  _scraper.onlyHTML = false;
}

async function handleExecutionTimeout(
  startTime: [number, number],
  maxExecutionTimeSeconds: number,
  _logger: LogService,
): Promise<boolean> {
  const elapsedTime = process.hrtime(startTime);
  const elapsedSeconds = elapsedTime[0] + elapsedTime[1] / 1e9;
  if (elapsedSeconds > maxExecutionTimeSeconds) {
    _logger.log(`Execution time exceeded ${maxExecutionTimeSeconds} seconds`);
    return true;
  }
  return false;
}

function logVehicleError(_logger: LogService, link: string, executionResults: ScraperResults): void {
  _logger.log(`Error parsing vehicle details - ${link}`);
  executionResults.skippedVehicles++;
}

async function handleVehicleExpiration(
  vehicleDetails: ScrapedVehicle,
  params: MarketParams,
  _logger: LogService,
): Promise<boolean> {
  const expirationDate = DateTime.now().minus({ days: Number(params.daysSinceListed) });
  const listingDate = DateTime.fromISO(vehicleDetails.listingDate);
  if (listingDate.toMillis() < expirationDate.toMillis()) {
    _logger.log(`Listing Date: ${listingDate.toISO()} Expiration Date: ${expirationDate.toISO()}`);
    _logger.log(`Vehicle ${vehicleDetails.vehicleOriginalId} is outside the expiration date`);
    return true;
  }
  return false;
}

async function handleVehicleValidation(
  vehicleDetails: ScrapedVehicle,
  params: { searchRadius: number },
  enforceRadius: boolean,
  centerCoordinate: { latitude: number; longitude: number },
  dealershipExcludedKeywords: string[],
  _logger: LogService,
  skippedVehicles: ScrapedVehicle[],
): Promise<boolean> {
  if (enforceRadius && !isLocationWithinBoundary(centerCoordinate, vehicleDetails.location, params.searchRadius)) {
    _logger.log(`Vehicle ${vehicleDetails.vehicleOriginalId} is outside the radius`);
    skippedVehicles.push(vehicleDetails);
    return true;
  }

  if (vehicleDetails.suspectedDealer) {
    _logger.log(`Vehicle ${vehicleDetails.vehicleOriginalId} is a suspected dealer`);
    skippedVehicles.push(vehicleDetails);
    return true;
  }

  if (!vehicleDetails.make || !vehicleDetails.model) {
    _logger.log(`Vehicle ${vehicleDetails.vehicleOriginalId} is missing make or model`);
    skippedVehicles.push(vehicleDetails);
    return true;
  }

  const testStrings = [vehicleDetails.description, vehicleDetails.originalTitle, vehicleDetails.sellerName];
  if (
    testStrings.some((str) => hasIgnoreTerm(str)) ||
    testStrings.some((str) => hasIgnoreTerm(str, dealershipExcludedKeywords))
  ) {
    _logger.log(`Vehicle ${vehicleDetails.vehicleOriginalId} contains ignored terms`);
    skippedVehicles.push(vehicleDetails);
    return true;
  }

  return false;
}

function logProcessingError(_logger: LogService, err: Error, link: string, executionResults: ScraperResults): void {
  _logger.log(`Error processing vehicle ${link}`);
  _logger.error(err);
  executionResults.skippedVehicles++;
}

/**
 * @description Process the market
 * @param _market - The market to process
 * @param _logger - The logger service
 * @param _scraper - The scraper service
 * @returns The scraper results
 */
const processMarket = async (
  _market: Market,
  _logger: LogService,
  _scraper: ScraperService,
): Promise<ScraperResults> => {
  // Set the parameters
  const params = getParams(_market);

  // Get the facebook search link
  let facebookMarketUrls = getMarketUrl(_market, params);

  _scraper.onlyHTML = false;

  // Initialize the scraper with authentication and return if should use all links
  const useAllLinks = await initAuth(_market, _scraper, _logger);

  // Take the first 3 links if not using all links
  if (!useAllLinks) {
    _logger.log('Using only the first 3 links -- not using all links');
    facebookMarketUrls = facebookMarketUrls.slice(0, 3);
  }

  // Record the start time for the execution
  const startTime = process.hrtime();
  const maxExecutionTimeSeconds = 60 * 60; // 45 minutes in seconds

  const dealershipExcludedKeywords = _market.dealershipGroup?.dealershipGroupSettings
    .filter((setting) => setting.name === DealershipSettingsTypes.ExcludedKeywords)
    ?.map((setting) => setting.value);

  const executionResults: ScraperResults = {
    success: true,
    executionStatus: ExecutionStatus.Success,
    executionMessage: '',
    totalVehicles: 0,
    skippedVehicles: 0,
    validVehicles: 0,
    results: [],
  };

  await sleep(1000);
  await randomSleep();

  const scrapedVehicles: ScrapedVehicle[] = [];
  const skippedVehicles: ScrapedVehicle[] = [];

  // Check if the market has a radius enforcement
  const centerCoordinate = { latitude: _market.latitude, longitude: _market.longitude };
  const enforceRadius =
    !!+_market.marketSettings.find((setting) => setting.name === MarketSettingsTypes.EnforceMileage)?.value &&
    !!centerCoordinate?.longitude &&
    !!centerCoordinate?.latitude;
  const maxResults = +process.env.FACEBOOK_MAX_RESULTS || SCRAPER_DEFAULT_SETTINGS.MAX_RESULTS;

  _logger.log(`Enforcing radius: ${enforceRadius} - ${params.searchRadius}`);

  await processFacebookMarketUrls(
    facebookMarketUrls,
    _scraper,
    _logger,
    _market,
    params,
    maxResults,
    maxExecutionTimeSeconds,
    centerCoordinate,
    enforceRadius,
    dealershipExcludedKeywords,
    startTime,
    executionResults,
    scrapedVehicles,
    skippedVehicles,
    useAllLinks,
  );

  executionResults.totalVehicles = scrapedVehicles.length + skippedVehicles.length;

  // Save the results to a file
  if (+process.env.FACEBOOK_SAVE_RESULTS) {
    try {
      await fs.promises.mkdir('executions', { recursive: true });
      const millis = DateTime.now().toMillis();

      await fs.promises.writeFile(
        `executions/results-${_market.dealershipGroup?.name} (${_market?.location})-${millis}.json`.toLowerCase(),
        JSON.stringify(scrapedVehicles, null, 2),
      );

      await fs.promises.writeFile(
        `executions/skipped-${_market.dealershipGroup?.name} (${_market?.location})-${millis}.json`.toLowerCase(),
        JSON.stringify(skippedVehicles, null, 2),
      );
    } catch (e) {
      _logger.error(e);
    }
  }

  executionResults.totalVehicles = scrapedVehicles.length + skippedVehicles.length;

  // Set the results
  executionResults.skippedVehicles = skippedVehicles.length;
  executionResults.results = scrapedVehicles;

  return executionResults;
};

const getLinks = async (
  facebookRadius: { index: number; value: number },
  markedId: number,
  _scraper: ScraperService,
  _logger: LogService,
  skipRadius = false,
  usingVPN = false,
) => {
  // Set the radius
  try {
    if (!skipRadius) {
      await _scraper.currentPage.evaluate(async () => {
        document.querySelector<HTMLButtonElement>('[role="dialog"] [aria-label="Close"]')?.click();
      });
      await sleep(5000);

      _logger.log(`Setting the search radius to ${facebookRadius.value} miles`);
      await _scraper.currentPage.evaluate(async (radiusIndex) => {
        async function setRadius(radiusIndex: number) {
          document.querySelectorAll('[id="seo_filters"]')?.[0]?.querySelectorAll('div')?.[0].click();
          await new Promise((resolve) => setTimeout(resolve, 10000));

          document.querySelectorAll<HTMLButtonElement>('label[aria-label="Radius"]')?.[0]?.click();
          await new Promise((resolve) => setTimeout(resolve, 5000));

          document
            .querySelectorAll('div[role="listbox"]')?.[0]
            ?.querySelectorAll<HTMLButtonElement>('div[role="option"')
            ?.[radiusIndex]?.click();
          await new Promise((resolve) => setTimeout(resolve, 5000));

          document.querySelectorAll<HTMLButtonElement>('div[aria-label="Apply"]')?.[0]?.click();
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }

        await setRadius(radiusIndex);
      }, facebookRadius.index);

      await _scraper.currentPage.evaluate(async () => {
        document.querySelector<HTMLButtonElement>('[role="dialog"] [aria-label="Close"]')?.click();
      });
      await sleep(5000);
    } else {
      _logger.log('Skipping setting the search radius');
    }
  } catch (e) {
    _logger.error(e);
    await _scraper.takeScreenshot('facebook-radius-error');
    throw new Error('Unable to set the search radius');
  }

  await randomSleep();

  // Take a screenshot
  await _scraper.takeScreenshot(`facebook-search-results-init-market-${markedId}`);

  const links: string[] = [];

  // Scroll to the bottom based on the env variable
  _logger.log('Scrolling to the bottom of the page');

  // Scroll to the bottom of the page for 60 seconds
  let keepScrolling = true;
  const newLinks: string[] = [];

  const timeoutInstance = setTimeout(
    () => {
      keepScrolling = false;
      _logger.log('Stopping the scroll');
    },
    +usingVPN ? 17000 : 35000, // 17 seconds if using VPN, 35 seconds if not
  );

  const scrollWithMouse = async () => {
    const htmlLinks = await _scraper.currentPage.evaluate(() => {
      // Use querySelector with an attribute selector to find the <a> tag
      const anchorElements = document.querySelectorAll('a[href*="/marketplace/item/"]');

      // Create an array of the href attributes
      const links = Array.from(anchorElements).map(
        (element) => `https://www.facebook.com${element.getAttribute('href').split('/?')[0]}`,
      );

      try {
        document.querySelector<HTMLElement>('[aria-label="Close"]')?.click();
      } catch {
        // Do nothing
      }

      return links;
    });

    // Add the new links to the links array
    newLinks.push(...htmlLinks);

    // Validates if we don't have any new links
    if (newLinks.length === 0 || newLinks.length < 24) {
      keepScrolling = false;
      clearTimeout(timeoutInstance);
    } else {
      // Randomize a scroll between 75 and 95
      const scrollAmount = Math.floor(Math.random() * (95 - 75 + 1) + 75);

      // Scroll with the mouse if we have new links
      await _scraper.scrollWithMouse(scrollAmount);
    }
  };

  while (keepScrolling) {
    await scrollWithMouse();
  }

  links.push(...newLinks);

  // Remove duplicate links
  const uniqueLinks = Array.from(new Set(links));

  // Take a screenshot
  await _scraper.takeScreenshot(`facebook-search-results-end-market-${markedId}`);

  _logger.log(`Found ${uniqueLinks.length} vehicles on the page`);
  await randomSleep();

  if (uniqueLinks.length >= 2) {
    // First link
    const firstLink = uniqueLinks?.[0];
    _logger.log(`First link: ${firstLink}`);

    const lastLink = uniqueLinks[uniqueLinks.length - 1];
    _logger.log(`Last link: ${lastLink}`);
  }

  return uniqueLinks || [];
};

/**
 * Finds and returns the links found on the HTML that starts with marketplace/item
 * @param html
 */
export const processLinks = (html: string) => {
  const links = html.match(/\/marketplace\/item\/\d+/g) || [];
  return links.map((link: string) => `https://www.facebook.com${link}`);
};

/**
 * @description Clear the page block
 * @param _scraper - The scraper service
 *
 */
const clearPageBlock = async (_scraper: ScraperService) => {
  try {
    await _scraper.click('.__fb-light-mode.x1n2onr6.x1vjfegm');
    await randomSleep();
  } catch {
    // Do nothing
  }
};

/**
 * @description Get the vehicle details
 * @param _scraper - The scraper service
 * @param _logger - The logger service
 * @param _link - The vehicle link
 * @returns The scraped vehicle
 */
export const getVehicleDetails = async (
  _scraper: ScraperService,
  _logger: LogService,
  _link: string,
): Promise<ScrapedVehicle> => {
  // Visit the vehicle link
  // retrying up to 3 times

  let retries = 3;
  let errorDetails = false;

  do {
    try {
      _logger.log(`Processing vehicle link: ${_link}`);
      await _scraper.navigateToUrl(_link, 35);
      errorDetails = false;
      break;
    } catch (err) {
      _logger.log('Error navigating to the vehicle link');
      _logger.error(err);
      retries--;
      errorDetails = true;
    }
  } while (retries > 0);

  if (errorDetails) {
    throw new Error('Error navigating to the vehicle link - too many retries');
  }

  // Get the vehicle details
  const productHtml = await _scraper.currentPage.evaluate(() => document.body.outerHTML);

  // Save the HTML to a file
  if (+process.env.FACEBOOK_SAVE_PRODUCT_HTML) {
    try {
      await fs.promises.mkdir('html', { recursive: true });
      await fs.promises.writeFile('html/product.html', productHtml);
    } catch (e) {
      _logger.error(e);
    }
  }

  let suspectedDealer = false;

  // Extract vehicle ID from the link
  const id = /https:\/\/www\.facebook\.com\/marketplace\/item\/([^/]+)/.exec(_link)?.[1];

  const locationText = new RegExp(`"props":{"location":{(.*?)},"id":"${id}"`).exec(productHtml)?.[1];
  let location: {
    radius: number;
    latitude: number;
    longitude: number;
  } = undefined;

  if (locationText) {
    try {
      location = JSON.parse(`{${locationText}}`);
    } catch (e) {
      _logger.error(e);
    }
  }

  // Extract original title
  const originalTitle =
    removeUtf8EscapedCharacters(new RegExp(`"marketplace_listing_title":"([^"]+)","id":"${id}"`).exec(productHtml)?.[1])
      ?.replace(/\s+/g, ' ')
      ?.trim() || '';

  // Extract price
  const askingPrice = Number(
    /"listing_price":{"amount_with_offset":"(.*?)","currency":"USD","amount":"(.*?)"/gm
      .exec(productHtml)?.[2]
      ?.trim() || '',
  );

  // Description
  const description =
    removeUtf8EscapedCharacters(
      /"redacted_description":{"text":"(.*?)"}/gm.exec(productHtml)?.[1]?.replace("'", '')?.trim(),
    ) || '';

  // Extract listing photos
  let listingPhotos: unknown[] = [];
  try {
    listingPhotos = JSON.parse(/"listing_photos":(\[.*?\])/gm.exec(productHtml)?.[1]).map(
      (item: { image: { uri: string }; accessibility_caption: string }) => ({
        url: item.image.uri,
        caption: item.accessibility_caption,
      }),
    );
    if (listingPhotos?.some((photo: { caption: string }) => photo.caption?.toLowerCase().indexOf('dealer') > -1)) {
      suspectedDealer = true;
    }
  } catch (e) {
    _logger.log('Error parsing listing photos');
    _logger.error(e);
  }

  // Total owners
  const totalOwners = convertTotalOwnersStringToNumber(
    /"vehicle_number_of_owners":"(.*?)"/gm.exec(productHtml)?.[1]?.trim(),
  );

  // Mileage
  const mileageMatch =
    /"vehicle_odometer_data":{"unit":"MILES","value":(.*?)}/gm.exec(productHtml) ||
    /"vehicle_odometer_data":{"unit":null,"value":(.*?)}/gm.exec(productHtml);
  const mileage = Number(mileageMatch?.[1]?.trim());

  // Seller name
  const sellerCms = /"seller_cms":{"id":"(.*?)"}/gm.exec(productHtml)?.[1];

  const sellerName = removeUtf8EscapedCharacters(
    /"actors":\[{"__typename":"User","name":"(.*?)"/gm.exec(productHtml)?.[1]?.trim(),
  )?.trim();

  // Get seller id
  const sellerId = /"actors":\[{"__typename":"User","name":"(.*?)","id":"(.*?)"}/gm.exec(productHtml)?.[2]?.trim();

  // Dealership Name
  const dealerName = /"dealership_name":"(.*?)","seller":{"/gm.exec(productHtml)?.[1]?.trim() || '';
  if (dealerName) {
    suspectedDealer = true;
  }

  // Vehicle seller type
  const sellerType = /"vehicle_seller_type":"(.*?)"/gm.exec(productHtml)?.[1]?.trim();
  if (sellerType !== 'PRIVATE_SELLER') {
    suspectedDealer = true;
  }

  // Listing date
  const listingTime = /"creation_time":([0-9]*)/gm.exec(productHtml)?.[1]?.trim();
  const listingDate = DateTime.fromMillis(Number(listingTime) * 1000)
    .toUTC()
    .toISO();

  // Year, make, model and trim
  const year = +originalTitle.trim().split(' ')?.[0]?.trim();

  const make = removeUtf8EscapedCharacters(
    /"vehicle_make_display_name":"(.*?)"/gm.exec(productHtml)?.[1]?.trim(),
  )?.trim();

  const model = removeUtf8EscapedCharacters(
    /"vehicle_model_display_name":"(.*?)"/gm.exec(productHtml)?.[1]?.trim(),
  )?.trim();

  const trim =
    removeUtf8EscapedCharacters(/"vehicle_trim_display_name":"(.*?)"/gm.exec(productHtml)?.[1]?.trim())?.trim() || '';

  const extColor = removeUtf8EscapedCharacters(
    /"vehicle_exterior_color":"(.*?)"/gm.exec(productHtml)?.[1]?.trim(),
  )?.trim();
  const intColor = removeUtf8EscapedCharacters(
    /"vehicle_interior_color":"(.*?)"/gm.exec(productHtml)?.[1]?.trim(),
  )?.trim();
  const fuelType = removeUtf8EscapedCharacters(/"vehicle_fuel_type":"(.*?)"/gm.exec(productHtml)?.[1]?.trim())?.trim();
  const vehicleFeatures = JSON.parse(/"vehicle_features":(\[.*?\])/gm.exec(productHtml)?.[1])
    .map((item: { display_name: string }) => item.display_name)
    .join(', ');
  const transmission = removeUtf8EscapedCharacters(
    /"vehicle_transmission":"(.*?)"/gm.exec(productHtml)?.[1]?.trim(),
  )?.trim();

  const vehicleAttributes = [];

  if (extColor) {
    vehicleAttributes.push({
      name: VEHICLE_ATTRIBUTES.extColor,
      value: extColor,
    });
  }

  if (intColor) {
    vehicleAttributes.push({
      name: VEHICLE_ATTRIBUTES.intColor,
      value: intColor,
    });
  }

  if (fuelType) {
    vehicleAttributes.push({
      name: VEHICLE_ATTRIBUTES.fuelType,
      value: fuelType,
    });
  }

  if (vehicleFeatures) {
    vehicleAttributes.push({
      name: VEHICLE_ATTRIBUTES.options,
      value: vehicleFeatures,
    });
  }

  if (transmission) {
    vehicleAttributes.push({
      name: VEHICLE_ATTRIBUTES.transmission,
      value: transmission,
    });
  }

  if (sellerCms) {
    vehicleAttributes.push({
      name: VEHICLE_ATTRIBUTES.sellerCms,
      value: sellerCms,
    });
  }

  // Ensure to return or process the extracted data as needed
  return {
    vehicleOriginalId: id,
    title: `${year} ${make} ${model} ${trim}`,
    originalTitle,
    askingPrice,
    description,
    images: listingPhotos.map((photo: { url: string }) => photo.url),
    totalOwners,
    mileage,
    sellerName,
    listingDate,
    year,
    make,
    model,
    trim,
    sellerPhone: '',
    sellerEmail: '',
    suspectedDealer,
    vin: '',
    link: _link?.split('?')?.[0],
    location,
    sellerId,
    vehicleAttributes,
  };
};