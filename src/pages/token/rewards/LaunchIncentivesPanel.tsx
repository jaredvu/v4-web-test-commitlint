import { useEffect } from 'react';

import { useQuery } from 'react-query';
import { useDispatch } from 'react-redux';
import styled, { AnyStyledComponent } from 'styled-components';

import { ButtonAction } from '@/constants/buttons';
import { DialogTypes } from '@/constants/dialogs';
import { STRING_KEYS } from '@/constants/localization';

import { useAccounts, useBreakpoints, useStringGetter } from '@/hooks';

import { ChaosLabsIcon } from '@/icons';
import breakpoints from '@/styles/breakpoints';
import { layoutMixins } from '@/styles/layoutMixins';

import { Button } from '@/components/Button';
import { Icon, IconName } from '@/components/Icon';
import { Output, OutputType } from '@/components/Output';
import { Panel } from '@/components/Panel';
import { Tag, TagSize } from '@/components/Tag';

import { markLaunchIncentivesSeen } from '@/state/configs';
import { openDialog } from '@/state/dialogs';

import { log } from '@/lib/telemetry';

export const LaunchIncentivesPanel = ({ className }: { className?: string }) => {
  const { isNotTablet } = useBreakpoints();
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(markLaunchIncentivesSeen());
  }, []);

  return isNotTablet ? (
    <Styled.Panel
      className={className}
      slotHeader={<LaunchIncentivesTitle />}
      slotRight={<EstimatedRewards />}
    >
      <LaunchIncentivesContent />
    </Styled.Panel>
  ) : (
    <Styled.Panel className={className}>
      <Styled.Column>
        <EstimatedRewards />
        <LaunchIncentivesTitle />
        <LaunchIncentivesContent />
      </Styled.Column>
    </Styled.Panel>
  );
};

const LaunchIncentivesTitle = () => {
  const stringGetter = useStringGetter();
  return (
    <Styled.Title>
      {stringGetter({
        key: STRING_KEYS.LAUNCH_INCENTIVES_TITLE,
        params: {
          FOR_V4: <Styled.ForV4>{stringGetter({ key: STRING_KEYS.FOR_V4 })}</Styled.ForV4>,
        },
      })}
      <Styled.NewTag size={TagSize.Medium}>{stringGetter({ key: STRING_KEYS.NEW })}</Styled.NewTag>
    </Styled.Title>
  );
};

const EstimatedRewards = () => {
  const stringGetter = useStringGetter();
  const { dydxAddress } = useAccounts();

  const { data: seasonNumber } = useQuery({
    queryKey: 'chaos_labs_season_number',
    queryFn: async () => {
      const resp = await fetch('https://cloud.chaoslabs.co/query/ccar-perpetuals', {
        method: 'POST',
        headers: {
          'apollographql-client-name': 'dydx-v4',
          'content-type': 'application/json',
          protocol: 'dydx-v4',
        },
        body: JSON.stringify({
          operationName: 'TradingSeasons',
          variables: {},
          query: `query TradingSeasons {
        tradingSeasons {
          label
        }
      }`,
        }),
      });
      const seasons = (await resp.json())?.data?.tradingSeasons;
      return seasons && seasons.length > 0 ? seasons[seasons.length - 1].label : undefined;
    },
    onError: (error: Error) => log('LaunchIncentives/fetchSeasonNumber', error),
  });

  const { data, isLoading } = useQuery({
    enabled: !!dydxAddress,
    queryKey: `launch_incentives_rewards_${dydxAddress ?? ''}`,
    queryFn: async () => {
      if (!dydxAddress) return undefined;
      const resp = await fetch(`https://cloud.chaoslabs.co/query/api/dydx/points/${dydxAddress}`);
      return (await resp.json())?.incentivePoints;
    },
    onError: (error: Error) => log('LaunchIncentives/fetchPoints', error),
  });

  return (
    <Styled.EstimatedRewardsCard>
      <Styled.EstimatedRewardsCardContent>
        <div>
          <span>{stringGetter({ key: STRING_KEYS.ESTIMATED_REWARDS })}</span>
          {seasonNumber !== undefined && (
            <Styled.Season>
              {stringGetter({
                key: STRING_KEYS.LAUNCH_INCENTIVES_SEASON_NUM,
                params: { SEASON_NUMBER: seasonNumber },
              })}
            </Styled.Season>
          )}
        </div>

        <Styled.Points>
          <Output type={OutputType.Number} value={data} isLoading={isLoading} fractionDigits={2} />
          {data !== undefined && stringGetter({ key: STRING_KEYS.POINTS })}
        </Styled.Points>
      </Styled.EstimatedRewardsCardContent>

      <Styled.Image src="/rewards-stars.svg" />
    </Styled.EstimatedRewardsCard>
  );
};

const LaunchIncentivesContent = () => {
  const stringGetter = useStringGetter();
  const dispatch = useDispatch();

  return (
    <Styled.Column>
      <Styled.Description>
        {stringGetter({ key: STRING_KEYS.LAUNCH_INCENTIVES_DESCRIPTION })}{' '}
      </Styled.Description>
      <Styled.ChaosLabsLogo>
        {stringGetter({ key: STRING_KEYS.POWERED_BY_ALL_CAPS })} <ChaosLabsIcon />
      </Styled.ChaosLabsLogo>
      <Styled.ButtonRow>
        <Styled.AboutButton
          action={ButtonAction.Base}
          onClick={() => {
            dispatch(
              openDialog({
                type: DialogTypes.ExternalLink,
                dialogProps: { link: 'https://dydx.exchange/blog/v4-full-trading' },
              })
            );
          }}
          slotRight={<Icon iconName={IconName.LinkOut} />}
        >
          {stringGetter({ key: STRING_KEYS.ABOUT })}
        </Styled.AboutButton>
        <Styled.Button
          action={ButtonAction.Primary}
          onClick={() => {
            dispatch(
              openDialog({
                type: DialogTypes.ExternalLink,
                dialogProps: { link: 'https://community.chaoslabs.xyz/dydx-v4/risk/leaderboard' },
              })
            );
          }}
          slotRight={<Icon iconName={IconName.LinkOut} />}
          slotLeft={<Icon iconName={IconName.Leaderboard} />}
        >
          {stringGetter({ key: STRING_KEYS.LEADERBOARD })}
        </Styled.Button>
      </Styled.ButtonRow>
    </Styled.Column>
  );
};

const Styled: Record<string, AnyStyledComponent> = {};

Styled.Panel = styled(Panel)`
  background-color: var(--color-layer-3);
  width: 100%;
`;

Styled.ForV4 = styled.span`
  color: var(--color-text-0);
`;

Styled.Title = styled.h3`
  ${layoutMixins.inlineRow}
  font: var(--font-medium-book);
  color: var(--color-text-2);

  @media ${breakpoints.notTablet} {
    padding: var(--panel-paddingY) var(--panel-paddingX) 0;
  }
`;

Styled.Description = styled.div`
  color: var(--color-text-0);
  --link-color: var(--color-text-1);

  a {
    display: inline;
    text-decoration: underline;
    text-underline-offset: 0.25rem;

    ::before {
      content: ' ';
    }
  }
`;

Styled.ButtonRow = styled.div`
  ${layoutMixins.inlineRow}
  gap: 0.75rem;
  margin-top: 0.5rem;

  a:last-child {
    --button-width: 100%;
  }
`;

Styled.Button = styled(Button)`
  --button-padding: 0 1rem;
`;

Styled.AboutButton = styled(Styled.Button)`
  --button-textColor: var(--color-text-2);
  --button-backgroundColor: var(--color-layer-6);
  --button-border: solid var(--border-width) var(--color-layer-7);
`;

Styled.Column = styled.div`
  ${layoutMixins.flexColumn}
  gap: 0.5rem;
`;

Styled.EstimatedRewardsCard = styled.div`
  ${layoutMixins.spacedRow}
  padding: 1rem 1.25rem;
  min-width: 19rem;
  height: calc(100% - calc(1.5rem * 2));
  margin: 1.5rem;

  background-color: var(--color-layer-5);
  background-image: url('/dots-background.svg');
  background-size: cover;

  border-radius: 0.75rem;
  border: solid var(--border-width) var(--color-layer-6);
  color: var(--color-text-1);

  @media ${breakpoints.tablet} {
    margin: 0 0 0.5rem;
  }
`;

Styled.EstimatedRewardsCardContent = styled.div`
  ${layoutMixins.flexColumn}
  gap: 1rem;
  height: 100%;
  justify-content: space-between;

  div {
    ${layoutMixins.flexColumn}
    gap: 0.15rem;
    font: var(--font-medium-book);

    :first-child {
      color: var(--color-text-2);
    }
  }
`;

Styled.BackgroundDots = styled.img`
  position: absolute;
`;

Styled.Season = styled.span`
  font: var(--font-small-book);
  color: var(--color-text-1);
`;

Styled.Points = styled.span`
  ${layoutMixins.inlineRow}
  gap: 0.25rem;
  font: var(--font-large-book);
  color: var(--color-text-0);

  output {
    color: var(--color-text-2);
  }
`;

Styled.Image = styled.img`
  position: relative;
  float: right;

  width: 5.25rem;
  height: auto;
`;

Styled.ChaosLabsLogo = styled.span`
  display: flex;
  align-items: center;
  gap: 0.5em;
  font: var(--font-tiny-medium);
`;

Styled.NewTag = styled(Tag)`
  color: var(--color-accent);
  background-color: var(--color-accent-faded);
`;
