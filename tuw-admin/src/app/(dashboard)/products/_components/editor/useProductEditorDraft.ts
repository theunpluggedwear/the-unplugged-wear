'use client';

import React from 'react';
import type { SizeChart } from '@tuw/heart/modules/catalog';
import type {
  ProductItem, ProductVariant, ProductAttribute, ProductDiscount,
  ProductGender, PhotoSettings,
} from '@/lib/admin-dto';
import { cardReducer, initialCardOpen } from './cards';
import type { CardKey } from './cards';

type Category = ProductItem['category'];
type ChartRowDrafts = Record<string, string>;

export function useGeneralDraft(initialCategory: Category) {
  const [formName, setFormName] = React.useState('');
  const [formSlug, setFormSlug] = React.useState('');
  const [formCategory, setFormCategory] = React.useState<Category>(initialCategory);
  const [formPrice, setFormPrice] = React.useState('48.00');
  const [formComparePrice, setFormComparePrice] = React.useState('');
  const [formCompareError, setFormCompareError] = React.useState<string | null>(null);
  const [formStock, setFormStock] = React.useState('30');
  const [formStyleCode, setFormStyleCode] = React.useState('');
  const [formSerialNo, setFormSerialNo] = React.useState('');
  const [formWeight, setFormWeight] = React.useState('');
  const [formShipWeight, setFormShipWeight] = React.useState('');
  const [formDims, setFormDims] = React.useState('');
  const [formGender, setFormGender] = React.useState<ProductGender | ''>('');
  const [formTax, setFormTax] = React.useState('');
  const [formHsn, setFormHsn] = React.useState('');
  const [formDiscounts, setFormDiscounts] = React.useState<ProductDiscount[]>([]);
  const [formAttributes, setFormAttributes] = React.useState<ProductAttribute[]>([]);
  const [attrDrafts, setAttrDrafts] = React.useState<Record<string, string>>({});
  const [newAttrName, setNewAttrName] = React.useState('');
  const [chartRowDrafts, setChartRowDrafts] = React.useState<ChartRowDrafts>({});
  const [newChartName, setNewChartName] = React.useState('');
  const [formSizeChartId, setFormSizeChartId] = React.useState('');
  const [formPartner, setFormPartner] = React.useState<ProductItem['partner']>('Qikink Direct API');
  const [formExchangePolicy, setFormExchangePolicy] = React.useState<NonNullable<ProductItem['exchangePolicy']>>('defects_only');
  const [formProductKind, setFormProductKind] = React.useState<NonNullable<ProductItem['productKind']>>('physical');
  const [formLowStock, setFormLowStock] = React.useState('');
  const [formStatus, setFormStatus] = React.useState<ProductItem['publicationStatus']>('published');
  const [formDescription, setFormDescription] = React.useState('Pre-shrunk premium heavyweight combed cotton with reinforced seams.');

  return {
    formName, setFormName, formSlug, setFormSlug, formCategory, setFormCategory,
    formPrice, setFormPrice, formComparePrice, setFormComparePrice,
    formCompareError, setFormCompareError, formStock, setFormStock,
    formStyleCode, setFormStyleCode, formSerialNo, setFormSerialNo,
    formWeight, setFormWeight, formShipWeight, setFormShipWeight, formDims, setFormDims,
    formGender, setFormGender, formTax, setFormTax, formHsn, setFormHsn,
    formDiscounts, setFormDiscounts, formAttributes, setFormAttributes,
    attrDrafts, setAttrDrafts, newAttrName, setNewAttrName,
    chartRowDrafts, setChartRowDrafts, newChartName, setNewChartName,
    formSizeChartId, setFormSizeChartId, formPartner, setFormPartner,
    formExchangePolicy, setFormExchangePolicy, formProductKind, setFormProductKind,
    formLowStock, setFormLowStock, formStatus, setFormStatus,
    formDescription, setFormDescription,
  };
}

export function useCardOpenState() {
  const [cards, dispatchCards] = React.useReducer(cardReducer, initialCardOpen);
  const setter = (card: CardKey) => (open: boolean) => dispatchCards({ type: 'SET', card, open });
  const resetCards = () => dispatchCards({ type: 'RESET' });

  return {
    basicCardOpen: cards.basic, setBasicCardOpen: setter('basic'),
    pricingCardOpen: cards.pricing, setPricingCardOpen: setter('pricing'),
    discountsCardOpen: cards.discounts, setDiscountsCardOpen: setter('discounts'),
    fulfillmentCardOpen: cards.fulfillment, setFulfillmentCardOpen: setter('fulfillment'),
    attributesCardOpen: cards.attributes, setAttributesCardOpen: setter('attributes'),
    specsDisplayCardOpen: cards.specsDisplay, setSpecsDisplayCardOpen: setter('specsDisplay'),
    specsClothingCardOpen: cards.specsClothing, setSpecsClothingCardOpen: setter('specsClothing'),
    specsSizeChartCardOpen: cards.specsSizeChart, setSpecsSizeChartCardOpen: setter('specsSizeChart'),
    specsMonogramCardOpen: cards.specsMonogram, setSpecsMonogramCardOpen: setter('specsMonogram'),
    mediaGalleryCardOpen: cards.mediaGallery, setMediaGalleryCardOpen: setter('mediaGallery'),
    mediaPresentationCardOpen: cards.mediaPresentation, setMediaPresentationCardOpen: setter('mediaPresentation'),
    variantsMatrixCardOpen: cards.variantsMatrix, setVariantsMatrixCardOpen: setter('variantsMatrix'),
    variantsPricingCardOpen: cards.variantsPricing, setVariantsPricingCardOpen: setter('variantsPricing'),
    variantsStockCardOpen: cards.variantsStock, setVariantsStockCardOpen: setter('variantsStock'),
    resetCards,
  };
}

export function useMediaDraft() {
  const [formPhoto, setFormPhoto] = React.useState<PhotoSettings>({ layout: 'carousel', ratio: '4:3', showPhotos: true });
  const [addImageUrl, setAddImageUrl] = React.useState('');
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const [formImages, setFormImages] = React.useState<
    Array<{ id: string; src: string; name: string; persisted: boolean }>
  >([]);
  const [stageIndex, setStageIndex] = React.useState(0);
  const [mediaWide, setMediaWide] = React.useState(false);
  const [mediaCards, setMediaCards] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const mediaWrapRef = React.useRef<HTMLDivElement>(null);
  const dragIdRef = React.useRef<string | null>(null);

  return {
    formPhoto, setFormPhoto, addImageUrl, setAddImageUrl, photoInputRef,
    formImages, setFormImages, stageIndex, setStageIndex,
    mediaWide, setMediaWide, mediaCards, setMediaCards,
    dragActive, setDragActive, draggingId, setDraggingId,
    mediaWrapRef, dragIdRef,
  };
}

export function useSpecsDraft() {
  const [formFabricGsm, setFormFabricGsm] = React.useState('');
  const [formCut, setFormCut] = React.useState('');
  const [formModelDims, setFormModelDims] = React.useState('');
  const [formCare, setFormCare] = React.useState('');
  const [formMonogramEnabled, setFormMonogramEnabled] = React.useState(false);
  const [formMonogramChars, setFormMonogramChars] = React.useState('3');
  const [formMonogramUpcharge, setFormMonogramUpcharge] = React.useState('12.00');
  const [visibleSections, setVisibleSections] = React.useState({ monogram: true });

  return {
    formFabricGsm, setFormFabricGsm, formCut, setFormCut,
    formModelDims, setFormModelDims, formCare, setFormCare,
    formMonogramEnabled, setFormMonogramEnabled,
    formMonogramChars, setFormMonogramChars,
    formMonogramUpcharge, setFormMonogramUpcharge,
    visibleSections, setVisibleSections,
  };
}

export function useVariantDraft() {
  const [formVariants, setFormVariants] = React.useState<ProductVariant[]>([]);
  const [formAdjustments, setFormAdjustments] = React.useState<Record<string, number>>({});
  const [adjustmentDrafts, setAdjustmentDrafts] = React.useState<Record<string, string>>({});
  const [priceDrafts, setPriceDrafts] = React.useState<Record<string, string>>({});

  return {
    formVariants, setFormVariants, formAdjustments, setFormAdjustments,
    adjustmentDrafts, setAdjustmentDrafts, priceDrafts, setPriceDrafts,
  };
}

export function useProductEditorDraft(initialCategory: Category) {
  return {
    ...useGeneralDraft(initialCategory),
    ...useCardOpenState(),
    ...useMediaDraft(),
    ...useSpecsDraft(),
    ...useVariantDraft(),
  };
}
