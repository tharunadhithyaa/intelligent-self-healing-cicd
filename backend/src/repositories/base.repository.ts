import {
  Model,
  Document,
  FilterQuery,
  UpdateQuery,
  QueryOptions,
} from "mongoose";

export class BaseRepository<T extends Document> {
  constructor(protected readonly model: Model<T>) {}

  async create(data: Partial<T>): Promise<T> {
    return this.model.create(data);
  }

  async findById(id: string, select?: string): Promise<T | null> {
    const query = this.model.findById(id);
    if (select) {
      query.select(select);
    }
    return query.exec();
  }

  async findOne(filter: FilterQuery<T>, select?: string): Promise<T | null> {
    const query = this.model.findOne(filter);
    if (select) {
      query.select(select);
    }
    return query.exec();
  }

  async find(
    filter: FilterQuery<T> = {},
    select?: string,
    options?: QueryOptions,
  ): Promise<T[]> {
    const query = this.model.find(filter);
    if (select) {
      query.select(select);
    }
    if (options?.sort) {
      query.sort(options.sort);
    }
    if (options?.limit) {
      query.limit(options.limit);
    }
    if (options?.skip) {
      query.skip(options.skip);
    }
    return query.exec();
  }

  async updateById(
    id: string,
    data: UpdateQuery<T>,
    options?: QueryOptions,
  ): Promise<T | null> {
    return this.model
      .findByIdAndUpdate(id, data, {
        new: true,
        runValidators: true,
        ...options,
      })
      .exec();
  }

  async updateOne(
    filter: FilterQuery<T>,
    data: UpdateQuery<T>,
    options?: QueryOptions,
  ): Promise<T | null> {
    return this.model
      .findOneAndUpdate(filter, data, {
        new: true,
        runValidators: true,
        ...options,
      })
      .exec();
  }

  async deleteById(id: string): Promise<T | null> {
    return this.model.findByIdAndDelete(id).exec();
  }

  async deleteMany(filter: FilterQuery<T>): Promise<number> {
    const result = await this.model.deleteMany(filter).exec();
    return result.deletedCount;
  }

  async count(filter: FilterQuery<T> = {}): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  async exists(filter: FilterQuery<T>): Promise<boolean> {
    const result = await this.model.exists(filter);
    return result !== null;
  }
}
