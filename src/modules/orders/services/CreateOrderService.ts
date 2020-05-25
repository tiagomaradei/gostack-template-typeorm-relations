import { inject, injectable } from 'tsyringe';
import AppError from '@shared/errors/AppError';
import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import IOrdersRepository from '../repositories/IOrdersRepository';
import Order from '../infra/typeorm/entities/Order';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError("This customer dosen't exist.");
    }

    const productsInDB = await this.productsRepository.findAllById(products);

    if (productsInDB.length !== products.length) {
      throw new AppError('One or more produtcs are invalid.');
    }

    const newProductsQuantities = products.map(product => {
      const [newQuantity] = productsInDB
        .filter(productInDB => productInDB.id === product.id)
        .map(productInDB => {
          return productInDB.quantity - product.quantity;
        });

      return newQuantity;
    });

    newProductsQuantities.forEach(quantity => {
      if (quantity < 0) {
        throw new AppError('Insuficient product quantity in stock.');
      }
    });

    await this.productsRepository.updateQuantity(products);

    return this.ordersRepository.create({
      customer,
      products: products.map(product => {
        const [price] = productsInDB
          .filter(productInDB => productInDB.id === product.id)
          .map(productInDB => productInDB.price);

        return {
          product_id: product.id,
          price,
          quantity: product.quantity,
        };
      }),
    });
  }
}

export default CreateOrderService;
