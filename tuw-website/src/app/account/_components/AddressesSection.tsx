'use client';

import React, { useState } from 'react';
import Badge from '@storefront/components/ui/Badge';
import Button from '@storefront/components/ui/Button';
import Input from '@storefront/components/ui/Input';
import Checkbox from '@storefront/components/ui/Checkbox';
import Modal from '@storefront/components/ui/Modal';
import { useStore } from '@storefront/mocks/store';
import { useSession } from '@storefront/lib/session';
import type { Address } from '@storefront/lib/types';
import { Plus } from 'lucide-react';
import { useAccountPage } from './AccountShell';
import { ADDRESS_LABELS, EMPTY_ADDRESS_FORM, type AddressForm } from './account-helpers';

/** /account/addresses — the saved address book with add, edit, default and remove. */
export default function AddressesSection() {
  const { account } = useAccountPage();
  const { addresses, saveAddress, deleteAddress, setDefaultAddress } = account;
  const { addToast } = useStore();
  const { session } = useSession();
  const accountName = session?.name ?? '';
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressSaving, setAddressSaving] = useState(false);

  // Address add/edit state. Form values stay in place if the dialog is reopened after a cancel.
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressForm>(EMPTY_ADDRESS_FORM);
  const [addressPendingDelete, setAddressPendingDelete] = useState<Address | null>(null);
  const updateAddressForm = (patch: Partial<AddressForm>) => setAddressForm((f) => ({ ...f, ...patch }));

  const openNewAddress = () => {
    setAddressForm({
      ...EMPTY_ADDRESS_FORM,
      label: addresses.some((a) => a.label === 'Home') ? 'Work' : 'Home',
      fullName: accountName,
      isDefault: addresses.length === 0,
    });
    setIsAddressModalOpen(true);
  };

  const openEditAddress = (addr: Address) => {
    const isPreset = (ADDRESS_LABELS as readonly string[]).includes(addr.label ?? '');
    setAddressForm({
      id: addr.id,
      label: isPreset ? addr.label : addr.label ? 'Other' : 'Home',
      otherLabel: isPreset ? '' : addr.label ?? '',
      fullName: addr.fullName,
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2 ?? '',
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      phone: addr.phone,
      isDefault: Boolean(addr.isDefault),
    });
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (addressSaving) return;
    const { id, otherLabel, label, addressLine2, ...fields } = addressForm;
    setAddressSaving(true);
    setAddressError(null);
    void saveAddress({
      ...fields,
      id: id ?? 'new-address',
      label: label === 'Other' ? otherLabel.trim() || 'Other' : label,
      addressLine2: addressLine2?.trim() || undefined,
      country: 'India',
    }).then((outcome) => {
      // On failure the dialog stays open with every typed value.
      if (!outcome.ok) return setAddressError(outcome.message);
      setIsAddressModalOpen(false);
      addToast({ type: 'success', title: 'Address saved' });
    }).catch(() => {
      setAddressError('Could not save that address. Your entries are kept — please try again.');
    }).finally(() => {
      setAddressSaving(false);
    });
  };

  return (
    <>
      <section aria-labelledby="addresses-heading" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="addresses-heading" className="font-heading text-xl font-medium text-store-charcoal">
            Addresses
          </h2>
          <Button variant="dark" size="sm" onClick={openNewAddress}>
            <Plus size={14} aria-hidden="true" /> Add address
          </Button>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {addresses.map((addr) => (
            <li
              key={addr.id}
              className={`bg-store-surface border p-6 flex flex-col justify-between ${
                addr.isDefault ? 'border-store-charcoal' : 'border-store-card-border'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-wider font-medium text-store-charcoal">
                    {addr.label || 'Address'}
                  </p>
                  {addr.isDefault && <Badge variant="dark">Default</Badge>}
                </div>
                <h3 className="text-base font-medium text-store-charcoal">{addr.fullName}</h3>
                <p className="text-sm text-store-text-secondary leading-relaxed">
                  {addr.addressLine1}
                  {addr.addressLine2 && <><br />{addr.addressLine2}</>}
                  <br />
                  {addr.city}, {addr.state} {addr.postalCode}
                  <br />
                  {addr.country}
                </p>
                <p className="text-sm text-store-text-secondary">Phone: {addr.phone}</p>
              </div>

              <div className="pt-5 border-t border-store-card-border mt-5 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => openEditAddress(addr)}>
                  Edit
                </Button>
                {!addr.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => void setDefaultAddress(addr.id)
                    .then((o) => addToast(o.ok ? { type: 'success', title: 'Default address updated' } : { type: 'error', title: o.message }))
                    .catch(() => addToast({ type: 'error', title: 'Could not update the default address. Please try again.' }))}>
                    Set as default
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddressPendingDelete(addr)}
                  aria-label={`Remove ${addr.label || ''} address for ${addr.fullName}`}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={openNewAddress}
              className="w-full h-full min-h-48 flex flex-col items-center justify-center gap-2 border border-dashed border-store-card-border text-sm text-store-text-secondary hover:border-store-charcoal hover:text-store-charcoal transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
            >
              <Plus size={20} aria-hidden="true" />
              Add a new address
              <span className="text-xs">Home, work, a friend’s place…</span>
            </button>
          </li>
        </ul>
      </section>

      {/* Add / Edit Address Modal */}
      <Modal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        title={addressForm.id ? 'Edit address' : 'Add a new address'}
      >
        <form onSubmit={handleSaveAddress} className="space-y-4">
          {addressError && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{addressError}</p>
          )}
          <fieldset>
            <legend className="text-sm font-medium text-store-charcoal mb-2">Save this address as</legend>
            <div className="flex flex-wrap gap-2">
              {ADDRESS_LABELS.map((option) => {
                const isActive = addressForm.label === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => updateAddressForm({ label: option })}
                    className={`px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold ${
                      isActive
                        ? 'bg-store-charcoal text-white'
                        : 'border border-store-border text-store-text-secondary hover:border-store-charcoal hover:text-store-charcoal'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </fieldset>
          {addressForm.label === 'Other' && (
            <Input
              label="Name for this address"
              placeholder="e.g. Parents, Studio"
              value={addressForm.otherLabel}
              onChange={(e) => updateAddressForm({ otherLabel: e.target.value })}
              required
            />
          )}
          <Input label="Full name" value={addressForm.fullName} onChange={(e) => updateAddressForm({ fullName: e.target.value })} required />
          <Input label="Address line 1" value={addressForm.addressLine1} onChange={(e) => updateAddressForm({ addressLine1: e.target.value })} required />
          <Input label="Address line 2 (optional)" value={addressForm.addressLine2 ?? ''} onChange={(e) => updateAddressForm({ addressLine2: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" value={addressForm.city} onChange={(e) => updateAddressForm({ city: e.target.value })} required />
            <Input label="State" value={addressForm.state} onChange={(e) => updateAddressForm({ state: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="PIN code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              title="6-digit PIN code"
              value={addressForm.postalCode}
              onChange={(e) => updateAddressForm({ postalCode: e.target.value })}
              required
            />
            <Input label="Phone" type="tel" value={addressForm.phone} onChange={(e) => updateAddressForm({ phone: e.target.value })} required />
          </div>
          <Checkbox
            checked={Boolean(addressForm.isDefault)}
            onChange={(checked) => updateAddressForm({ isDefault: checked })}
            label="Use as my default delivery address"
          />
          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" size="md" onClick={() => setIsAddressModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="dark" size="md" type="submit" disabled={addressSaving}>
              {addressSaving ? 'Saving…' : 'Save address'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Remove Address Confirmation */}
      <Modal
        isOpen={addressPendingDelete !== null}
        onClose={() => setAddressPendingDelete(null)}
        title="Remove this address?"
      >
        {addressPendingDelete && (
          <div className="space-y-5">
            <p className="text-sm text-store-text-secondary">
              {addressPendingDelete.label ? `${addressPendingDelete.label}: ` : ''}
              {addressPendingDelete.fullName}, {addressPendingDelete.addressLine1}, {addressPendingDelete.city}.
              {addressPendingDelete.isDefault && addresses.length > 1 ? ' Your next saved address will become the default.' : ''}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="md" onClick={() => setAddressPendingDelete(null)}>
                Keep it
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={() => {
                  void deleteAddress(addressPendingDelete.id).then((outcome) => {
                    setAddressPendingDelete(null);
                    addToast(outcome.ok ? { type: 'info', title: 'Address removed' } : { type: 'error', title: outcome.message });
                  }).catch(() => {
                    setAddressPendingDelete(null);
                    addToast({ type: 'error', title: 'Could not remove that address. Please try again.' });
                  });
                }}
              >
                Remove address
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
