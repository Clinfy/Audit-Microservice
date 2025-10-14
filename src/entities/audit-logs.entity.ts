import {BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn} from "typeorm";

@Entity('audit_logs')
export class AuditLogsEntity extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    pattern: string;

    @Column({type: 'jsonb'})
    payload: Record<string, any>;

    @CreateDateColumn()
    received_at: Date;
    
}