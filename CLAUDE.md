# WavyMania

WavyMania is a social media platform to connect people in real life to empower and make social connections. Waves can be every Activity. 

## Architecture
See @../../.claude/MSArchitecture/AuthService.md für AuthService details (JWT verification, GITCLIENT role).
See @../../.claude/MSArchitecture/ProfileService.md für ProfileService details (Profile von userids).
See @../../.claude/MSArchitecture/ObjectService.md für ObjectService details (Persistenz).
See @../../.claude/MSArchitecture/MediaService.md für MediaService details (Bilder und Videos ).
See @../../.claude/MSArchitecture/EmailService.md für EmailService details (Sende Nachfragen zum Issue-Ersteller).
See @../../.claude/MSArchitecture/ExceptionService.md für ExceptionService details (Sende Fehlerfälle).
See @../../.claude/MSArchitecture/MessageService.md für MessageService details (Nachrichten zu anderen Usern).
See @../../.claude/MSArchitecture/GitService.md für GitService details (Issue creation)
See @../WaveService/WaveService.md für WaveService details (Kampagnen-Lifecycle, Joins, Referral).
See @../PaymentService/PaymentService.md für PaymentService details (Checkout-Sessions, Refunds).
See @../TicketService/TicketService.md für TicketService details (Events, Ticketverkauf, QR-Check-in, Zweitmarkt).
See @../TokenService/TokenService.md für TokenService details ($WAVY-Token, Phase 4, noch nicht implementiert).
See @../MarketService/MarketService.md für MarketService details (Produktkatalog, Drops, Bestandsreservierung).
See @../GeoService/GeoService.md für GeoService details (Live-Heatmap, H3-Zellen, k-Anonymität).
See @../ActivationService/ActivationService.md für ActivationService details (TOTP-Check-ins, Standortverifikation).


## Anti-Patterns — Never Use

### DOM mutation for visibility (React reconciler overwrites it)
```tsx
// WRONG — React resets style.display to the JSX value on every re-render
videoEl.style.display = 'block';

// CORRECT — let React control display via hasCam read at render time
<video style={{ display: hasCam ? 'block' : 'none' }} />
```

### `array.filter()` directly in a Zustand selector
```tsx
// WRONG — filter() always returns a new reference → triggers re-render on every store update
const knockers = useRoomLockStore((s) => s.knockers.filter((k) => k.room === 'Meetingraum'));

// CORRECT — stabilize with useMemo
const allKnockers = useRoomLockStore((s) => s.knockers);
const knockers    = useMemo(() => allKnockers.filter((k) => k.room === 'Meetingraum'), [allKnockers]);
```

### `admitted` as a dep when `setAdmitted()` is called in the same effect (React #185)
```tsx
// WRONG — causes React error #185 "Maximum update depth exceeded"
useEffect(() => {
  if (admitted) lockStore.setAdmitted(false); // modifies the dep inside the effect
}, [admitted, ...]);

// CORRECT — split into two separate effects; consume the flag in a dedicated effect
useEffect(() => { /* main logic, no admitted dep */ }, [currentRoom, connect, ...]);
useEffect(() => {
  if (!admitted) return;
  lockStore.setAdmitted(false); // safe: admitted is dep here, but this effect doesn't loop
}, [admitted, currentRoom, ...]);
```
