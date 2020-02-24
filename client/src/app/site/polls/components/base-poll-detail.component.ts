import { OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';

import { TranslateService } from '@ngx-translate/core';
import { Label } from 'ng2-charts';
import { BehaviorSubject, from, Observable } from 'rxjs';

import { GroupRepositoryService } from 'app/core/repositories/users/group-repository.service';
import { BasePollDialogService } from 'app/core/ui-services/base-poll-dialog.service';
import { PromptService } from 'app/core/ui-services/prompt.service';
import { ChartData, ChartType } from 'app/shared/components/charts/charts.component';
import { BaseViewComponent } from 'app/site/base/base-view';
import { ViewGroup } from 'app/site/users/models/view-group';
import { ViewUser } from 'app/site/users/models/view-user';
import { BasePollRepositoryService } from '../services/base-poll-repository.service';
import { PollService } from '../services/poll.service';
import { ViewBasePoll } from '../models/view-base-poll';

export interface BaseVoteData {
    user?: ViewUser;
}

export abstract class BasePollDetailComponent<V extends ViewBasePoll> extends BaseViewComponent implements OnInit {
    /**
     * All the groups of users.
     */
    public userGroups: ViewGroup[] = [];

    /**
     * Holding all groups.
     */
    public groupObservable: Observable<ViewGroup[]> = null;

    /**
     * Details for the iconification of the votes
     */
    public voteOptionStyle = {
        Y: {
            css: 'voted-yes',
            icon: 'thumb_up'
        },
        N: {
            css: 'voted-no',
            icon: 'thumb_down'
        },
        A: {
            css: 'voted-abstain',
            icon: 'trip_origin'
        }
    };

    /**
     * The reference to the poll.
     */
    public poll: V = null;

    /**
     * Sets the type of the shown chart, if votes are entered.
     */
    public abstract get chartType(): ChartType;

    /**
     * The different labels for the votes (used for chart).
     */
    public labels: Label[] = [];

    /**
     * Subject, that holds the data for the chart.
     */
    public chartDataSubject: BehaviorSubject<ChartData> = new BehaviorSubject(null);

    // The observable for the votes-per-user table
    public votesDataObservable: Observable<BaseVoteData[]>;

    /**
     * Constructor
     *
     * @param title
     * @param translate
     * @param matSnackbar
     * @param repo
     * @param route
     * @param router
     * @param fb
     * @param groupRepo
     * @param location
     * @param promptService
     * @param dialog
     */
    public constructor(
        title: Title,
        protected translate: TranslateService,
        matSnackbar: MatSnackBar,
        protected repo: BasePollRepositoryService,
        protected route: ActivatedRoute,
        protected groupRepo: GroupRepositoryService,
        protected promptService: PromptService,
        protected pollDialog: BasePollDialogService<V>,
        protected pollService: PollService
    ) {
        super(title, translate, matSnackbar);
    }

    /**
     * OnInit-method.
     */
    public ngOnInit(): void {
        this.findComponentById();

        this.groupObservable = this.groupRepo.getViewModelListObservable();
        this.subscriptions.push(
            this.groupRepo.getViewModelListObservable().subscribe(groups => (this.userGroups = groups))
        );
    }

    public async deletePoll(): Promise<void> {
        const title = 'Delete poll';
        const text = 'Do you really want to delete the selected poll?';

        if (await this.promptService.open(title, text)) {
            this.repo.delete(this.poll).then(() => this.onDeleted(), this.raiseError);
        }
    }

    public async pseudoanonymizePoll(): Promise<void> {
        const title = 'Anonymize single votes';
        const text = 'Do you really want to anonymize all votes? This cannot be undone.';

        if (await this.promptService.open(title, text)) {
            this.repo.pseudoanonymize(this.poll).then(() => this.onPollLoaded(), this.raiseError); // votes have changed, but not the poll, so the components have to be informed about the update
        }
    }

    /**
     * Opens dialog for editing the poll
     */
    public openDialog(viewPoll: V): void {
        this.pollDialog.openDialog(viewPoll);
    }

    protected onDeleted(): void {}

    /**
     * Called after the poll has been loaded. Meant to be overwritten by subclasses who need initial access to the poll
     */
    protected onPollLoaded(): void {}

    protected onPollWithOptionsLoaded(): void {}

    protected onStateChanged(): void {}

    protected abstract hasPerms(): boolean;

    /**
     * sets the votes data only if the poll wasn't pseudoanonymized
     */
    protected setVotesData(data: BaseVoteData[]): void {
        if (data.every(voteDate => !voteDate.user)) {
            this.votesDataObservable = null;
        } else {
            this.votesDataObservable = from([data]);
        }
    }

    /**
     * Initializes data for the shown chart.
     * Could be overwritten to implement custom chart data.
     */
    protected initChartData(): void {
        this.chartDataSubject.next(this.pollService.generateChartData(this.poll));
    }

    /**
     * This checks, if the poll has votes.
     */
    private checkData(): void {
        if (this.poll.state === 3 || this.poll.state === 4) {
            setTimeout(() => this.initChartData());
        }
    }

    /**
     * Helper-function to search for this poll and display data or create a new one.
     */
    private findComponentById(): void {
        const params = this.route.snapshot.params;
        if (params && params.id) {
            this.subscriptions.push(
                this.repo.getViewModelObservable(params.id).subscribe(poll => {
                    if (poll) {
                        this.poll = poll;
                        this.onPollLoaded();
                        this.waitForOptions();
                        this.checkData();
                    }
                })
            );
        }
    }

    /**
     * Waits until poll's options are loaded.
     */
    private waitForOptions(): void {
        if (!this.poll.options || !this.poll.options.length) {
            setTimeout(() => this.waitForOptions(), 1);
        } else {
            this.onPollWithOptionsLoaded();
        }
    }
}