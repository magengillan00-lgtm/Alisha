'use client'

import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'

// ✅ قائمة الأفاتارات المتاحة
export interface AvatarOption {
  id: string
  name: string
  nameAr: string
  modelPath: string
  icon: string
  description: string
}

export const AVAILABLE_AVATARS: AvatarOption[] = [
  {
    id: 'kei',
    name: 'Kei',
    nameAr: 'كي',
    modelPath: '/live2d/kei_en/kei_basic_free/runtime/kei_basic_free.model3.json',
    icon: '👧',
    description: 'فتاة بشعر بني قصير - النموذج الافتراضي',
  },
  {
    id: 'haru',
    name: 'Haru',
    nameAr: 'هارو',
    modelPath: '/live2d/Haru/Haru.model3.json',
    icon: '👩',
    description: 'فتاة بشعر برتقالي - شخصية ودودة',
  },
  {
    id: 'hiyori',
    name: 'Hiyori',
    nameAr: 'هيوري',
    modelPath: '/live2d/Hiyori/Hiyori.model3.json',
    icon: '🎀',
    description: 'فتاة بشعر أسود - شخصية لطيفة',
  },
  {
    id: 'mao',
    name: 'Mao',
    nameAr: 'ماو',
    modelPath: '/live2d/Mao/Mao.model3.json',
    icon: '🐱',
    description: 'فتاة بشعر بني - شخصية مرحة',
  },
  {
    id: 'natori',
    name: 'Natori',
    nameAr: 'ناتوري',
    modelPath: '/live2d/Natori/Natori.model3.json',
    icon: '🌟',
    description: 'فتاة بشعر أشقر - شخصية هادئة',
  },
  {
    id: 'rice',
    name: 'Rice',
    nameAr: 'رايس',
    modelPath: '/live2d/Rice/Rice.model3.json',
    icon: '🍚',
    description: 'فتاة صغيرة - شخصية لطيفة',
  },
]

export function getAvatarModelPath(avatarId: string): string {
  const avatar = AVAILABLE_AVATARS.find(a => a.id === avatarId)
  return avatar?.modelPath || AVAILABLE_AVATARS[0].modelPath
}

export function AvatarSelector() {
  const { selectedAvatar, setSelectedAvatar } = useAppStore()
  const [tempAvatar, setTempAvatar] = useState(selectedAvatar)

  const handleSelect = (id: string) => {
    setTempAvatar(id)
    setSelectedAvatar(id)
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-gray-400 mb-3">
        اختر الأفاتار المفضل لك. سيتم تطبيق التغيير فوراً.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {AVAILABLE_AVATARS.map((avatar) => (
          <button
            key={avatar.id}
            onClick={() => handleSelect(avatar.id)}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-right ${
              tempAvatar === avatar.id
                ? 'bg-pink-500/15 border-pink-500/40'
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 ${
              tempAvatar === avatar.id
                ? 'bg-pink-500/20'
                : 'bg-white/10'
            }`}>
              {avatar.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${tempAvatar === avatar.id ? 'text-pink-300' : 'text-gray-300'}`}>
                {avatar.nameAr} ({avatar.name})
              </p>
              <p className="text-[10px] text-gray-500 truncate">
                {avatar.description}
              </p>
            </div>
            {tempAvatar === avatar.id && (
              <div className="w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>

      <p className="text-[10px] text-gray-600 mt-2">
        💡 جميع الأفاتارات هي نماذج Live2D متحركة من Cubism Web Samples.
      </p>
    </div>
  )
}
