"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CalendarDays,
  CarFront,
  CreditCard,
  FileText,
  Phone,
  UserRound,
  X,
} from "lucide-react";
import { createSubscriptionAction, CreateSubscriptionSuccess } from "@/actions/mensualidades/createSubscriptionAction";



type VehicleTypeValue =
  | "CAR"
  | "MOTO"
  | "TRUCK"
  | "BUS"
  | "TRACTOMULA"
  | "OTHER";

type PaymentMethodValue = "CASH" | "NEQUI" | "TRANSFER" | "OTHER";

type FieldErrorKey =
  | "fullName"
  | "document"
  | "phone"
  | "phoneSecondary"
  | "plate"
  | "type"
  | "amount"
  | "startAtIso"
  | "endAtIso"
  | "notes"
  | "initialPaidAmount"
  | "initialPaymentMethod"
  | "shiftId";

type CreateSubscriptionModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (result: CreateSubscriptionSuccess) => void;
  defaultShiftId?: string | null;
};

type FormState = {
  fullName: string;
  document: string;
  phone: string;
  phoneSecondary: string;
  plate: string;
  type: VehicleTypeValue;
  amount: string;
  startDate: string;
  notes: string;
  registerInitialPayment: boolean;
  initialPaidAmount: string;
  initialPaymentMethod: PaymentMethodValue;
  initialPaymentReference: string;
  initialPaymentNotes: string;
};

const VEHICLE_TYPES: Array<{
  value: VehicleTypeValue;
  label: string;
}> = [
  { value: "CAR", label: "Carro" },
  { value: "MOTO", label: "Moto" },
  { value: "TRUCK", label: "Camión" },
  { value: "BUS", label: "Bus" },
  { value: "TRACTOMULA", label: "Tractomula" },
  { value: "OTHER", label: "Otro" },
];

const PAYMENT_METHODS: Array<{
  value: PaymentMethodValue;
  label: string;
}> = [
  { value: "CASH", label: "Efectivo" },
  { value: "NEQUI", label: "Nequi" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "OTHER", label: "Otro" },
];

function getTodayBogotaDateInputValue() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addOneMonthClampedDateInput(dateValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return "";

  const [yearRaw, monthRaw, dayRaw] = dateValue.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return "";
  }

  const targetMonthIndex = month;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedTargetMonth = (targetMonthIndex % 12) + 1;

  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, normalizedTargetMonth, 0)
  ).getUTCDate();

  const clampedDay = Math.min(day, lastDayOfTargetMonth);

  return [
    String(targetYear).padStart(4, "0"),
    String(normalizedTargetMonth).padStart(2, "0"),
    String(clampedDay).padStart(2, "0"),
  ].join("-");
}

function buildBogotaStartIso(dateValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return "";
  return `${dateValue}T00:00:00.000-05:00`;
}

function buildBogotaEndIso(dateValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return "";
  return `${dateValue}T23:59:59.999-05:00`;
}

function normalizePlateInput(value: string) {
  return value.toUpperCase().replace(/\s+/g, "").slice(0, 12);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function createInitialFormState(): FormState {
  const startDate = getTodayBogotaDateInputValue();

  return {
    fullName: "",
    document: "",
    phone: "",
    phoneSecondary: "",
    plate: "",
    type: "CAR",
    amount: "",
    startDate,
    notes: "",
    registerInitialPayment: false,
    initialPaidAmount: "",
    initialPaymentMethod: "CASH",
    initialPaymentReference: "",
    initialPaymentNotes: "",
  };
}

function getParsedPositiveInteger(value: string) {
  if (!value.trim()) return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return NaN;
  return Math.trunc(numeric);
}

export default function CreateSubscriptionModal({
  open,
  onClose,
  onCreated,
  defaultShiftId,
}: CreateSubscriptionModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const [form, setForm] = React.useState<FormState>(createInitialFormState);
  const [fieldErrors, setFieldErrors] = React.useState<
    Partial<Record<FieldErrorKey, string>>
  >({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const endDate = React.useMemo(
    () => addOneMonthClampedDateInput(form.startDate),
    [form.startDate]
  );

  const parsedAmount = React.useMemo(
    () => getParsedPositiveInteger(form.amount),
    [form.amount]
  );

  const parsedInitialPaidAmount = React.useMemo(
    () => getParsedPositiveInteger(form.initialPaidAmount),
    [form.initialPaidAmount]
  );

  const safeAmount = Number.isFinite(parsedAmount) && parsedAmount > 0
    ? parsedAmount
    : 0;

  const safeInitialPaidAmount =
    form.registerInitialPayment &&
    Number.isFinite(parsedInitialPaidAmount) &&
    parsedInitialPaidAmount > 0
      ? parsedInitialPaidAmount
      : 0;

  const pendingPreview = Math.max(safeAmount - safeInitialPaidAmount, 0);

  const resetState = React.useCallback(() => {
    setForm(createInitialFormState());
    setFieldErrors({});
    setFormError(null);
  }, []);

  const handleClose = React.useCallback(() => {
    if (isPending) return;
    resetState();
    onClose();
  }, [isPending, onClose, resetState]);

  React.useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, handleClose]);

  React.useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  const setFieldValue = React.useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      setForm((current) => ({
        ...current,
        [field]: value,
      }));

      if (fieldErrors[field as FieldErrorKey]) {
        setFieldErrors((current) => ({
          ...current,
          [field as FieldErrorKey]: undefined,
        }));
      }

      if (formError) {
        setFormError(null);
      }
    },
    [fieldErrors, formError]
  );

  const validateClientSide = React.useCallback(() => {
    const nextErrors: Partial<Record<FieldErrorKey, string>> = {};

    if (!form.fullName.trim() || form.fullName.trim().length < 3) {
      nextErrors.fullName = "Ingresa el nombre completo del titular.";
    }

    const normalizedPlate = normalizePlateInput(form.plate);
    if (!normalizedPlate || normalizedPlate.length < 4) {
      nextErrors.plate = "Ingresa una placa válida.";
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      nextErrors.amount = "Ingresa un valor pactado válido.";
    }

    if (!form.startDate) {
      nextErrors.startAtIso = "Selecciona una fecha inicial.";
    }

    if (!endDate) {
      nextErrors.endAtIso =
        "No fue posible calcular la fecha final automáticamente.";
    }

    if (form.registerInitialPayment) {
      if (
        !Number.isFinite(parsedInitialPaidAmount) ||
        parsedInitialPaidAmount <= 0
      ) {
        nextErrors.initialPaidAmount = "Ingresa un abono inicial válido.";
      } else if (
        Number.isFinite(parsedAmount) &&
        parsedAmount > 0 &&
        parsedInitialPaidAmount > parsedAmount
      ) {
        nextErrors.initialPaidAmount =
          "El abono inicial no puede ser mayor al valor pactado.";
      }

      if (!form.initialPaymentMethod) {
        nextErrors.initialPaymentMethod =
          "Selecciona un método de pago válido.";
      }
    }

    setFieldErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }, [
    endDate,
    form.fullName,
    form.initialPaymentMethod,
    form.plate,
    form.registerInitialPayment,
    form.startDate,
    parsedAmount,
    parsedInitialPaidAmount,
  ]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isPending) return;

    const isValid = validateClientSide();
    if (!isValid) return;

    setFormError(null);

    startTransition(() => {
      void (async () => {
        const result = await createSubscriptionAction({
          fullName: form.fullName.trim(),
          document: form.document.trim() || undefined,
          phone: form.phone.trim() || undefined,
          phoneSecondary: form.phoneSecondary.trim() || undefined,
          plate: normalizePlateInput(form.plate),
          type: form.type,
          amount: Math.trunc(Number(form.amount)),
          startAtIso: buildBogotaStartIso(form.startDate),
          endAtIso: buildBogotaEndIso(endDate),
          notes: form.notes.trim() || undefined,
          initialPaidAmount: form.registerInitialPayment
            ? Math.trunc(Number(form.initialPaidAmount))
            : undefined,
          initialPaymentMethod: form.registerInitialPayment
            ? form.initialPaymentMethod
            : undefined,
          initialPaymentReference: form.registerInitialPayment
            ? form.initialPaymentReference.trim() || undefined
            : undefined,
          initialPaymentNotes: form.registerInitialPayment
            ? form.initialPaymentNotes.trim() || undefined
            : undefined,
          shiftId: defaultShiftId ?? undefined,
        });

        if (!result.ok) {
          if (result.field) {
            setFieldErrors((current) => ({
              ...current,
              [result.field as FieldErrorKey]: result.message,
            }));
          } else {
            setFormError(result.message);
          }
          return;
        }

        router.refresh();
        onCreated?.(result);
        handleClose();
      })();
    });
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-70 flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={handleClose}
      aria-hidden={false}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-subscription-modal-title"
        className="flex max-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-500">
              Mensualidades
            </p>
            <h2
              id="create-subscription-modal-title"
              className="text-xl font-semibold tracking-tight text-neutral-950"
            >
              Nueva mensualidad
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Registra el titular, el vehículo, el periodo y, si quieres, un
              abono inicial.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-6 px-5 py-5 sm:px-6 sm:py-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-6">
                <section className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-neutral-500" />
                    <h3 className="text-sm font-semibold text-neutral-900">
                      Titular
                    </h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="subscription-fullName"
                        className="mb-1.5 block text-sm font-medium text-neutral-800"
                      >
                        Nombre completo *
                      </label>
                      <input
                        id="subscription-fullName"
                        type="text"
                        value={form.fullName}
                        onChange={(event) =>
                          setFieldValue("fullName", event.target.value)
                        }
                        placeholder="Ej. Juan Carlos Pérez"
                        autoComplete="name"
                        className="h-11 w-full rounded-2xl border border-neutral-200 px-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
                      />
                      {fieldErrors.fullName ? (
                        <p className="mt-1.5 text-xs font-medium text-red-600">
                          {fieldErrors.fullName}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <label
                        htmlFor="subscription-document"
                        className="mb-1.5 block text-sm font-medium text-neutral-800"
                      >
                        Documento
                      </label>
                      <input
                        id="subscription-document"
                        type="text"
                        value={form.document}
                        onChange={(event) =>
                          setFieldValue("document", event.target.value)
                        }
                        placeholder="Cédula o identificación"
                        className="h-11 w-full rounded-2xl border border-neutral-200 px-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
                      />
                      {fieldErrors.document ? (
                        <p className="mt-1.5 text-xs font-medium text-red-600">
                          {fieldErrors.document}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <label
                        htmlFor="subscription-phone"
                        className="mb-1.5 block text-sm font-medium text-neutral-800"
                      >
                        Teléfono principal
                      </label>
                      <input
                        id="subscription-phone"
                        type="tel"
                        value={form.phone}
                        onChange={(event) =>
                          setFieldValue("phone", event.target.value)
                        }
                        placeholder="Ej. 3001234567"
                        autoComplete="tel"
                        className="h-11 w-full rounded-2xl border border-neutral-200 px-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
                      />
                      {fieldErrors.phone ? (
                        <p className="mt-1.5 text-xs font-medium text-red-600">
                          {fieldErrors.phone}
                        </p>
                      ) : null}
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="subscription-phoneSecondary"
                        className="mb-1.5 block text-sm font-medium text-neutral-800"
                      >
                        Teléfono adicional
                      </label>
                      <input
                        id="subscription-phoneSecondary"
                        type="tel"
                        value={form.phoneSecondary}
                        onChange={(event) =>
                          setFieldValue("phoneSecondary", event.target.value)
                        }
                        placeholder="Opcional"
                        autoComplete="off"
                        className="h-11 w-full rounded-2xl border border-neutral-200 px-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
                      />
                      {fieldErrors.phoneSecondary ? (
                        <p className="mt-1.5 text-xs font-medium text-red-600">
                          {fieldErrors.phoneSecondary}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <CarFront className="h-4 w-4 text-neutral-500" />
                    <h3 className="text-sm font-semibold text-neutral-900">
                      Vehículo
                    </h3>
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <label
                        htmlFor="subscription-plate"
                        className="mb-1.5 block text-sm font-medium text-neutral-800"
                      >
                        Placa *
                      </label>
                      <input
                        id="subscription-plate"
                        type="text"
                        inputMode="text"
                        value={form.plate}
                        onChange={(event) =>
                          setFieldValue(
                            "plate",
                            normalizePlateInput(event.target.value)
                          )
                        }
                        placeholder="Ej. ABC123"
                        autoComplete="off"
                        className="h-11 w-full rounded-2xl border border-neutral-200 px-4 text-sm font-medium uppercase tracking-wide text-neutral-900 outline-none transition placeholder:normal-case placeholder:tracking-normal placeholder:text-neutral-400 focus:border-neutral-400"
                      />
                      {fieldErrors.plate ? (
                        <p className="mt-1.5 text-xs font-medium text-red-600">
                          {fieldErrors.plate}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-medium text-neutral-800">
                        Tipo de vehículo *
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {VEHICLE_TYPES.map((vehicleType) => {
                          const isSelected = form.type === vehicleType.value;

                          return (
                            <button
                              key={vehicleType.value}
                              type="button"
                              onClick={() => setFieldValue("type", vehicleType.value)}
                              className={[
                                "rounded-2xl border px-3 py-3 text-sm font-medium transition",
                                isSelected
                                  ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:text-neutral-900",
                              ].join(" ")}
                            >
                              {vehicleType.label}
                            </button>
                          );
                        })}
                      </div>
                      {fieldErrors.type ? (
                        <p className="mt-1.5 text-xs font-medium text-red-600">
                          {fieldErrors.type}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-neutral-500" />
                    <h3 className="text-sm font-semibold text-neutral-900">
                      Periodo y valor
                    </h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="subscription-startDate"
                        className="mb-1.5 block text-sm font-medium text-neutral-800"
                      >
                        Fecha inicial *
                      </label>
                      <input
                        id="subscription-startDate"
                        type="date"
                        value={form.startDate}
                        onChange={(event) =>
                          setFieldValue("startDate", event.target.value)
                        }
                        className="h-11 w-full rounded-2xl border border-neutral-200 px-4 text-sm text-neutral-900 outline-none transition focus:border-neutral-400"
                      />
                      {fieldErrors.startAtIso ? (
                        <p className="mt-1.5 text-xs font-medium text-red-600">
                          {fieldErrors.startAtIso}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <label
                        htmlFor="subscription-endDate"
                        className="mb-1.5 block text-sm font-medium text-neutral-800"
                      >
                        Fecha final
                      </label>
                      <input
                        id="subscription-endDate"
                        type="date"
                        value={endDate}
                        readOnly
                        disabled
                        className="h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-100 px-4 text-sm text-neutral-700 outline-none"
                      />
                      <p className="mt-1.5 text-xs text-neutral-500">
                        Se calcula automáticamente a un mes del inicio.
                      </p>
                      {fieldErrors.endAtIso ? (
                        <p className="mt-1.5 text-xs font-medium text-red-600">
                          {fieldErrors.endAtIso}
                        </p>
                      ) : null}
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="subscription-amount"
                        className="mb-1.5 block text-sm font-medium text-neutral-800"
                      >
                        Valor pactado del mes *
                      </label>
                      <input
                        id="subscription-amount"
                        type="number"
                        min={0}
                        step={1000}
                        value={form.amount}
                        onChange={(event) =>
                          setFieldValue("amount", event.target.value)
                        }
                        placeholder="Ej. 180000"
                        inputMode="numeric"
                        className="h-11 w-full rounded-2xl border border-neutral-200 px-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
                      />
                      {fieldErrors.amount ? (
                        <p className="mt-1.5 text-xs font-medium text-red-600">
                          {fieldErrors.amount}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-neutral-500" />
                    <h3 className="text-sm font-semibold text-neutral-900">
                      Abono inicial
                    </h3>
                  </div>

                  <div className="space-y-4">
                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-200 p-3 transition hover:border-neutral-300">
                      <input
                        type="checkbox"
                        checked={form.registerInitialPayment}
                        onChange={(event) =>
                          setFieldValue(
                            "registerInitialPayment",
                            event.target.checked
                          )
                        }
                        className="mt-1 h-4 w-4 rounded border-neutral-300"
                      />
                      <div>
                        <p className="text-sm font-medium text-neutral-900">
                          Registrar un abono al crear la mensualidad
                        </p>
                        <p className="mt-0.5 text-sm text-neutral-600">
                          Úsalo si el cliente deja un pago parcial o completo de
                          una vez.
                        </p>
                      </div>
                    </label>

                    {form.registerInitialPayment ? (
                      <div className="grid gap-4 rounded-2xl bg-neutral-50 p-4 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="subscription-initialPaidAmount"
                            className="mb-1.5 block text-sm font-medium text-neutral-800"
                          >
                            Valor recibido *
                          </label>
                          <input
                            id="subscription-initialPaidAmount"
                            type="number"
                            min={0}
                            step={1000}
                            value={form.initialPaidAmount}
                            onChange={(event) =>
                              setFieldValue(
                                "initialPaidAmount",
                                event.target.value
                              )
                            }
                            placeholder="Ej. 50000"
                            inputMode="numeric"
                            className="h-11 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
                          />
                          {fieldErrors.initialPaidAmount ? (
                            <p className="mt-1.5 text-xs font-medium text-red-600">
                              {fieldErrors.initialPaidAmount}
                            </p>
                          ) : null}
                        </div>

                        <div>
                          <p className="mb-1.5 text-sm font-medium text-neutral-800">
                            Método de pago *
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {PAYMENT_METHODS.map((method) => {
                              const isSelected =
                                form.initialPaymentMethod === method.value;

                              return (
                                <button
                                  key={method.value}
                                  type="button"
                                  onClick={() =>
                                    setFieldValue(
                                      "initialPaymentMethod",
                                      method.value
                                    )
                                  }
                                  className={[
                                    "rounded-2xl border px-3 py-3 text-sm font-medium transition",
                                    isSelected
                                      ? "border-neutral-900 bg-neutral-900 text-white"
                                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:text-neutral-900",
                                  ].join(" ")}
                                >
                                  {method.label}
                                </button>
                              );
                            })}
                          </div>
                          {fieldErrors.initialPaymentMethod ? (
                            <p className="mt-1.5 text-xs font-medium text-red-600">
                              {fieldErrors.initialPaymentMethod}
                            </p>
                          ) : null}
                        </div>

                        <div>
                          <label
                            htmlFor="subscription-initialPaymentReference"
                            className="mb-1.5 block text-sm font-medium text-neutral-800"
                          >
                            Referencia
                          </label>
                          <input
                            id="subscription-initialPaymentReference"
                            type="text"
                            value={form.initialPaymentReference}
                            onChange={(event) =>
                              setFieldValue(
                                "initialPaymentReference",
                                event.target.value
                              )
                            }
                            placeholder="Opcional"
                            className="h-11 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="subscription-initialPaymentNotes"
                            className="mb-1.5 block text-sm font-medium text-neutral-800"
                          >
                            Nota del abono
                          </label>
                          <input
                            id="subscription-initialPaymentNotes"
                            type="text"
                            value={form.initialPaymentNotes}
                            onChange={(event) =>
                              setFieldValue(
                                "initialPaymentNotes",
                                event.target.value
                              )
                            }
                            placeholder="Opcional"
                            className="h-11 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-neutral-500" />
                    <h3 className="text-sm font-semibold text-neutral-900">
                      Notas
                    </h3>
                  </div>

                  <div>
                    <label
                      htmlFor="subscription-notes"
                      className="mb-1.5 block text-sm font-medium text-neutral-800"
                    >
                      Información importante
                    </label>
                    <textarea
                      id="subscription-notes"
                      rows={5}
                      value={form.notes}
                      onChange={(event) =>
                        setFieldValue("notes", event.target.value)
                      }
                      placeholder="Ej. sale usualmente a las 6:00 am, teléfono del hijo, recomendaciones, acuerdos especiales..."
                      className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
                    />
                    {fieldErrors.notes ? (
                      <p className="mt-1.5 text-xs font-medium text-red-600">
                        {fieldErrors.notes}
                      </p>
                    ) : null}
                  </div>
                </section>
              </div>

              <aside className="space-y-4">
                <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
                  <p className="text-sm font-semibold text-neutral-900">
                    Resumen
                  </p>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                        Titular
                      </p>
                      <p className="mt-1 text-sm font-medium text-neutral-900">
                        {form.fullName.trim() || "Sin definir"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                        Vehículo
                      </p>
                      <p className="mt-1 text-sm font-medium text-neutral-900">
                        {form.plate.trim() || "Sin placa"} ·{" "}
                        {
                          VEHICLE_TYPES.find(
                            (vehicleType) => vehicleType.value === form.type
                          )?.label
                        }
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                        Periodo
                      </p>
                      <p className="mt-1 text-sm font-medium text-neutral-900">
                        {form.startDate || "—"} a {endDate || "—"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                        Valor pactado
                      </p>
                      <p className="mt-1 text-lg font-semibold text-neutral-950">
                        {formatCurrency(safeAmount)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                            Valor recibido
                          </p>
                          <p className="mt-1 text-sm font-semibold text-neutral-900">
                            {formatCurrency(safeInitialPaidAmount)}
                          </p>
                        </div>

                        <div className="h-10 w-px bg-neutral-200" />

                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                            Saldo pendiente
                          </p>
                          <p className="mt-1 text-sm font-semibold text-neutral-900">
                            {formatCurrency(pendingPreview)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-4 w-4 text-neutral-500" />
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">
                        Consejo práctico
                      </p>
                      <p className="mt-1 text-sm leading-6 text-neutral-600">
                        En notas puedes guardar horarios frecuentes, teléfonos
                        adicionales o recomendaciones para el manejo del
                        vehículo.
                      </p>
                    </div>
                  </div>
                </div>

                {formError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm font-medium text-red-700">
                      {formError}
                    </p>
                  </div>
                ) : null}
              </aside>
            </div>
          </div>

          <div className="border-t border-neutral-200 bg-white px-5 py-4 sm:px-6">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={handleClose}
                disabled={isPending}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-neutral-200 px-5 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isPending}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <CreditCard className="h-4 w-4" />
                {isPending ? "Guardando..." : "Crear mensualidad"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}