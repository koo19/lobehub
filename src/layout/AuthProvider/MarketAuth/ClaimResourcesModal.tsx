'use client';

import { Flexbox, Modal, Text } from '@lobehub/ui';
import { App, Checkbox, List } from 'antd';
import { cssVar } from 'antd-style';
import { Package, Wrench } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { lambdaClient } from '@/libs/trpc/client';

import { type ClaimableResource, type ClaimableResources } from './useSocialConnect';

interface ClaimResourcesModalProps {
  onClose: () => void;
  onSuccess?: (claimedCount: number) => void;
  open: boolean;
  resources: ClaimableResources;
}

export const ClaimResourcesModal = memo<ClaimResourcesModalProps>(
  ({ open, onClose, resources, onSuccess }) => {
    const { t } = useTranslation('marketAuth');
    const { message } = App.useApp();

    const [selectedMcps, setSelectedMcps] = useState<Set<string>>(() => {
      return new Set(resources.mcps.map((r) => r.id));
    });
    const [selectedSkills, setSelectedSkills] = useState<Set<string>>(() => {
      return new Set(resources.skills.map((r) => r.id));
    });
    const [isClaiming, setIsClaiming] = useState(false);

    const toggleMcp = useCallback((id: string) => {
      setSelectedMcps((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    }, []);

    const toggleSkill = useCallback((id: string) => {
      setSelectedSkills((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    }, []);

    const handleClaim = useCallback(async () => {
      const mcpIds = [...selectedMcps];
      const skillIds = [...selectedSkills];

      if (mcpIds.length === 0 && skillIds.length === 0) {
        onClose();
        return;
      }

      setIsClaiming(true);
      try {
        await lambdaClient.market.socialProfile.claimResources.mutate({
          mcpIds,
          skillIds,
        });

        const totalClaimed = mcpIds.length + skillIds.length;
        message.success(
          t('claimResources.success', {
            count: totalClaimed,
            defaultValue: `Successfully claimed ${totalClaimed} resource(s)`,
          }),
        );
        onSuccess?.(totalClaimed);
        onClose();
      } catch (error) {
        console.error('[ClaimResources] Failed to claim:', error);
        message.error(
          t('claimResources.error', {
            defaultValue: 'Failed to claim resources. Please try again.',
          }),
        );
      } finally {
        setIsClaiming(false);
      }
    }, [selectedMcps, selectedSkills, message, t, onSuccess, onClose]);

    const totalSelected = selectedMcps.size + selectedSkills.size;

    const renderItem = (
      item: ClaimableResource,
      selected: boolean,
      onToggle: () => void,
      icon: React.ReactNode,
    ) => (
      <List.Item
        style={{
          cursor: 'pointer',
          padding: '8px 12px',
        }}
        onClick={onToggle}
      >
        <Flexbox horizontal align="center" gap={12} style={{ width: '100%' }}>
          <Checkbox checked={selected} />
          {icon}
          <Flexbox flex={1} gap={2}>
            <Text style={{ fontSize: 14 }}>{item.name}</Text>
            {item.description && (
              <Text style={{ fontSize: 12 }} type="secondary">
                {item.description}
              </Text>
            )}
          </Flexbox>
        </Flexbox>
      </List.Item>
    );

    return (
      <Modal
        centered
        cancelText={t('claimResources.skip', { defaultValue: 'Skip' })}
        confirmLoading={isClaiming}
        okText={t('claimResources.claim', { defaultValue: 'Claim Selected' })}
        open={open}
        title={false}
        width={480}
        onCancel={onClose}
        onOk={handleClaim}
      >
        <Text strong fontSize={20} style={{ display: 'block', marginBottom: 8 }}>
          {t('claimResources.title', { defaultValue: 'Claim Your Resources' })}
        </Text>
        <Text style={{ display: 'block', marginBottom: 16 }} type="secondary">
          {t('claimResources.description', {
            defaultValue: 'We found resources linked to your account that you can claim:',
          })}
        </Text>

        {resources.mcps.length > 0 && (
          <Flexbox gap={8} style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13 }} type="secondary">
              {t('claimResources.mcpSection', { defaultValue: 'MCP Servers' })}
            </Text>
            <List
              bordered
              dataSource={resources.mcps}
              size="small"
              style={{ borderRadius: cssVar.borderRadiusLG }}
              renderItem={(item) =>
                renderItem(
                  item,
                  selectedMcps.has(item.id),
                  () => toggleMcp(item.id),
                  <Package size={18} style={{ color: cssVar.colorTextSecondary }} />,
                )
              }
            />
          </Flexbox>
        )}

        {resources.skills.length > 0 && (
          <Flexbox gap={8}>
            <Text style={{ fontSize: 13 }} type="secondary">
              {t('claimResources.skillSection', { defaultValue: 'Skills' })}
            </Text>
            <List
              bordered
              dataSource={resources.skills}
              size="small"
              style={{ borderRadius: cssVar.borderRadiusLG }}
              renderItem={(item) =>
                renderItem(
                  item,
                  selectedSkills.has(item.id),
                  () => toggleSkill(item.id),
                  <Wrench size={18} style={{ color: cssVar.colorTextSecondary }} />,
                )
              }
            />
          </Flexbox>
        )}

        {totalSelected > 0 && (
          <Text style={{ display: 'block', fontSize: 12, marginTop: 12 }} type="secondary">
            {t('claimResources.selectedCount', {
              count: totalSelected,
              defaultValue: `${totalSelected} item(s) selected`,
            })}
          </Text>
        )}
      </Modal>
    );
  },
);

ClaimResourcesModal.displayName = 'ClaimResourcesModal';

export default ClaimResourcesModal;
