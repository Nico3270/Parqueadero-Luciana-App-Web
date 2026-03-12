import { printUsbTicket } from "./escpos-usb";

await printUsbTicket({
  kind: "ENTRY_TICKET",
  parkingName: "Parqueadero Luca",
  ticketCode: "TKT-0001",
  vehicle: { plate: "TYU258", type: "CAR" },
  entryAtIso: new Date().toISOString(),
});

console.log("OK test print");