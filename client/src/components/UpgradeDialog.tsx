import React, { useState } from 'react';
import { Crown, Check, X, Zap, Sparkles } from 'lucide-react';

export const PLANS = {
  free: { name: 'Free', price: 0, color: 'gray' },
  basic: { name: 'Basic', price: 99, color: 'blue' },
  pro: { name: 'Pro', price: 199, color: 'purple' },
};

export const FEATURES = {
  free: [
    '1 CV',
    '2 CV-analyser/månad',
    '20 jobbmatchningar/dag',
    'Max 30 ansökningar',
    'Grundstatistik',
  ],
  basic: [
    'Allt i Free',
    '3 CV-versioner',
    '10 CV-analyser/månad',
    '20 AI-anpassningar/månad',
    'Obegränsade matchningar',
    'Full ROI-statistik',
  ],
  pro: [
    'Allt i Basic',
    '10 CV-versioner',
    'Obegränsade analyser',
    'Obegränsade AI-anpassningar',
    'Auto-Apply aktiverat',
    'Cover letter AI',
    'Prioriterad support',
  ],
};

interface UpgradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: 'free' | 'basic' | 'pro';
  feature?: string;
  reason?: string;
  requiredTier?: 'basic' | 'pro';
  offerCredits?: boolean;
  onSelectPlan?: (plan: 'basic' | 'pro') => void;
}

export function UpgradeDialog({
  isOpen,
  onClose,
  currentTier = 'free',
  feature = 'denna funktion',
  reason,
  requiredTier = 'basic',
  offerCredits = false,
  onSelectPlan,
}: UpgradeDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro'>(requiredTier === 'pro' ? 'pro' : 'basic');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
          >
            <X size={24} />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Crown size={32} className="text-yellow-300" />
            <h2 className="text-3xl font-bold">Uppgradera Workme</h2>
          </div>
          {reason && (
            <p className="text-white/90 text-lg">{reason}</p>
          )}
        </div>

        {/* Plans Comparison */}
        <div className="p-6">
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {Object.entries(PLANS).map(([tier, plan]) => {
              const isCurrentPlan = tier === currentTier;
              const isRecommended = tier === requiredTier;
              const isDisabled = tier === 'free';

              return (
                <div
                  key={tier}
                  onClick={() => !isDisabled && setSelectedPlan(tier as 'basic' | 'pro')}
                  className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all ${
                    selectedPlan === tier
                      ? 'border-purple-500 shadow-lg scale-105'
                      : 'border-gray-200 hover:border-purple-300'
                  } ${isDisabled ? 'opacity-60' : ''}`}
                >
                  {isRecommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Rekommenderat
                    </div>
                  )}
                  
                  {isCurrentPlan && (
                    <div className="absolute top-3 right-3 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                      Nuvarande
                    </div>
                  )}

                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-600"> kr/mån</span>
                  </div>

                  <ul className="space-y-2 mb-4">
                    {FEATURES[tier as 'free' | 'basic' | 'pro'].map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {!isDisabled && (
                    <button
                      className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                        selectedPlan === tier
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {isCurrentPlan ? 'Nuvarande plan' : 'Välj plan'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Credits Option */}
          {offerCredits && currentTier !== 'free' && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl p-6 mb-6">
              <div className="flex items-start gap-4">
                <Sparkles className="text-yellow-600 mt-1" size={24} />
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-2">Behöver bara extra just nu?</h3>
                  <p className="text-gray-700 mb-4">
                    Köp credits istället för att uppgradera. Perfekt om du bara behöver några extra AI-anpassningar denna månad.
                  </p>
                  <div className="flex gap-3">
                    <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg font-semibold">
                      10 credits - 49 kr
                    </button>
                    <button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold">
                      50 credits - 199 kr
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50"
            >
              Kanske senare
            </button>
            <button
              onClick={() => {
                onSelectPlan?.(selectedPlan);
                onClose();
              }}
              className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition-shadow"
            >
              Uppgradera till {PLANS[selectedPlan]?.name} - {PLANS[selectedPlan]?.price} kr/mån
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FeatureLockBadgeProps {
  feature: string;
  requiredTier: 'basic' | 'pro';
  onClick: () => void;
}

export function FeatureLockBadge({ feature, requiredTier, onClick }: FeatureLockBadgeProps) {
  return (
    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-100 to-blue-100 border border-purple-300 rounded-lg px-4 py-2 cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <Crown size={18} className="text-purple-600" />
      <span className="text-sm font-semibold text-purple-900">
        {feature} ingår i Workme {requiredTier === 'basic' ? 'Basic' : 'Pro'}
      </span>
      <Zap size={16} className="text-yellow-500" />
    </div>
  );
}

interface UsageIndicatorProps {
  current: number;
  limit: number;
  type?: 'analyser' | 'anpassningar';
}

export function UsageIndicator({ current, limit, type = 'analyser' }: UsageIndicatorProps) {
  const percentage = limit === -1 ? 0 : (current / limit) * 100;
  const isUnlimited = limit === -1;
  const isNearLimit = !isUnlimited && percentage > 80;

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">
          {type.charAt(0).toUpperCase() + type.slice(1)} denna månad
        </span>
        <span className={`text-sm font-bold ${isNearLimit ? 'text-orange-600' : 'text-gray-900'}`}>
          {isUnlimited ? '∞' : `${current}/${limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all ${
                isNearLimit ? 'bg-orange-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          {isNearLimit && (
            <p className="text-xs text-orange-600">
              Du närmar dig din månadsgräns. Uppgradera för mer!
            </p>
          )}
        </>
      )}
    </div>
  );
}

