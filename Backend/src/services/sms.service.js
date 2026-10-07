import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * SMS India Hub (SMSIndiaHub) OTP delivery, ported from the OyeChotuu project.
 * Used for user, restaurant and delivery-partner login OTPs.
 *
 * India's DLT rules require the SMS text to match the registered template, so
 * the text comes from SMS_INDIA_HUB_MESSAGE_TEMPLATE where {BRAND} is the
 * variable part (the app name) and {OTP} is the code.
 */

const DEFAULT_BRAND = 'The Food Galaxy';
const DEFAULT_TEMPLATE = 'Welcome to the {BRAND} powered by Appzeto.Your OTP for registration is {OTP}.BGADEC';
const SMS_ENDPOINT = 'https://cloud.smsindiahub.in/api/mt/SendSMS';

/** Indian mobile number -> 91XXXXXXXXXX (always uses the last 10 digits). */
export const toIndianMsisdn = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 10) return '';
    return `91${digits.slice(-10)}`;
};

export const isSmsConfigured = () => Boolean(config.smsApiKey && config.smsSenderId);

export const buildOtpMessage = (otp) => {
    const template = String(config.smsMessageTemplate || DEFAULT_TEMPLATE);
    const brand = String(config.smsBrandName || DEFAULT_BRAND);
    return template.replace(/\{BRAND\}/g, brand).replace(/\{OTP\}/g, String(otp));
};

/**
 * Send the OTP SMS. Never throws: the OTP is already stored, an SMS problem
 * must not break the login flow. Returns true when the gateway accepted it.
 */
export const sendOtpSms = async (phone, otp) => {
    const msisdn = toIndianMsisdn(phone);
    if (!msisdn) {
        logger.warn(`[SMS] Skipping OTP SMS, invalid phone number: ${phone}`);
        return false;
    }
    if (!isSmsConfigured()) {
        logger.warn(`[SMS] OTP generated for ${msisdn} but SMS India Hub credentials are missing (SMS_INDIA_HUB_API_KEY / SMS_INDIA_HUB_SENDER_ID).`);
        return false;
    }

    try {
        // Format confirmed by SMS India Hub support for this account.
        const url = new URL(SMS_ENDPOINT);
        url.searchParams.append('APIKey', config.smsApiKey);
        url.searchParams.append('senderid', config.smsSenderId);
        url.searchParams.append('channel', 'Trans');
        url.searchParams.append('DCS', '0');
        url.searchParams.append('flashsms', '0');
        url.searchParams.append('number', msisdn);
        url.searchParams.append('text', buildOtpMessage(otp));
        url.searchParams.append('route', '0');
        if (config.smsDltTemplateId) url.searchParams.append('DLTTemplateId', config.smsDltTemplateId);
        if (config.smsEntityId) url.searchParams.append('PEId', config.smsEntityId);

        logger.info(`[SMS] Sending OTP to ${msisdn} via SMS India Hub...`);
        const response = await fetch(url.toString());
        const resultText = await response.text();
        // Never log the API key; the response body does not contain it.
        logger.info(`[SMS] Gateway response for ${msisdn}: ${resultText}`);

        // The gateway answers HTTP 200 even for failures, so inspect the body.
        let parsed = null;
        try { parsed = JSON.parse(resultText); } catch { /* plain text is fine */ }

        if (parsed && parsed.ErrorCode && parsed.ErrorCode !== '000') {
            logger.error(`[SMS] SMS India Hub error for ${msisdn}: [${parsed.ErrorCode}] ${parsed.ErrorMessage || resultText}`);
            if (parsed.ErrorCode === '006') {
                logger.error('[SMS] ErrorCode 006 = DLT template mismatch. The text must match your approved DLT template exactly (check SMS_INDIA_HUB_MESSAGE_TEMPLATE).');
            }
            return false;
        }
        if (!response.ok) {
            logger.error(`[SMS] HTTP ${response.status} from SMS India Hub for ${msisdn}: ${resultText}`);
            return false;
        }
        logger.info(`[SMS] OTP SMS accepted for ${msisdn}`);
        return true;
    } catch (error) {
        logger.error(`[SMS] Error sending OTP SMS to ${msisdn}: ${error.message}`);
        return false;
    }
};
