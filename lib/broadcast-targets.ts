import { Channel, isSwedishSmsAddress, recipientAddress } from './communication';
import type { BroadcastRecipient } from './broadcast-recipients';

export const recipientId = /^(legacy|profile):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function broadcastAddresses(recipients: BroadcastRecipient[], channel: Channel, language?: string) {
  const candidates = [...new Set(recipients
    .filter(r => channel !== 'whatsapp' || r.preferred_language === language)
    .map(r => recipientAddress(r, channel))
    .filter((address): address is string => !!address))];
  const addresses = channel === 'sms' ? candidates.filter(isSwedishSmsAddress) : candidates;
  return { addresses, excludedNonSwedish: candidates.length - addresses.length };
}
